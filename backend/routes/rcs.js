import express from 'express'
import { matchDeals, quickReplies } from '../../src/data/deals.js'
import { fetchDeals } from '../lib/deals.js'
import { sendRcsTurn, sendConfirmPrompt } from '../lib/twilioClient.js'
import { resolveQuickReplyId } from '../lib/session.js'
import { setPendingConfirmation, resolvePendingConfirmation } from '../lib/pendingConfirmations.js'
import { normalizePhone, resolveOrCreateAccount } from '../lib/accounts.js'
import { parseScreenshot } from '../lib/screenshotParser.js'
import { confirmMerchant } from '../lib/merchantDictionary.js'
import { getPreferenceProfile, MIN_UPLOADS_FOR_PROFILE } from '../lib/preferenceProfile.js'
import { matchDealsToProfile } from '../lib/profileDealMatch.js'
import { supabase } from '../lib/supabase.js'

const router = express.Router()

// Twilio's inbound webhook for both freeform replies and button/chip taps. Button taps
// arrive with a ButtonPayload (the `id` we set in rcs/templates.js, e.g. "save_0") in
// addition to Body — the exact inbound field names should be confirmed against a live
// payload in Twilio's console before this goes further; this is the shape documented for
// WhatsApp/RCS quick replies and is treated as provisional here.

// Fires once, exactly on the upload that crosses MIN_UPLOADS_FOR_PROFILE —
// not on every upload after — since this is meant to be the "you're in, and
// here's what we found" moment, not a repeated push. Ongoing proactive
// notification (the ongoing-analysis-job version of this, à la Calvin's
// cron) isn't in scope here; this is specifically the screenshot-upload
// feature's own acceptance criterion ("surfaces offers... for similar or
// exact goods"), satisfied at the moment a profile first becomes viable.
async function maybePushProfileMatches(from, account) {
  let profile
  try {
    profile = await getPreferenceProfile(account.id)
  } catch (err) {
    console.error('[rcs] failed to load preference profile:', err.message)
    return
  }
  if (profile.uploadCount !== MIN_UPLOADS_FOR_PROFILE) return

  let deals
  try {
    deals = await fetchDeals()
  } catch (err) {
    console.error('[rcs] failed to fetch deals for profile match:', err.message)
    return
  }

  const matches = matchDealsToProfile(deals, profile)
  if (matches.length === 0) return

  await sendRcsTurn(from, {
    text: `you're all set — found ${matches.length === 1 ? 'one' : matches.length} based on what you've been ordering.`,
    deals: matches,
    quickReplies: quickReplies.slice(0, 4),
  })
}

// Low-confidence gate: a dictionary hit is already zero-token-certain and
// skips this. A model-guessed merchant gets a one-tap yes/no — "yes" grows
// the dictionary (see merchantDictionary.confirmMerchant) so the same
// merchant resolves at zero tokens next time; "no" just acknowledges, since
// there's no better guess to fall back to without asking the user to retype
// it, which the guidance doc's own confidence-gate reasoning treats as not
// worth the friction for a receipt screenshot.
async function maybeSendConfirmPrompt(from, parsed) {
  if (parsed.merchantSource !== 'model' || !parsed.merchant) return
  await sendConfirmPrompt(from, `is this ${parsed.merchant}?`)
  setPendingConfirmation(from, { merchantName: parsed.merchant, category: parsed.category })
}

// Screenshot upload happens over text, after Donald's approval (per product
// decision — not during onboarding), so this is the natural place for it:
// same inbound webhook, gated the same way as everything else here. Parses
// via Claude, persists only the extracted structured data (never the image
// itself — see screenshotParser.js), and always replies so the user knows
// it landed, even when the specific merchant couldn't be identified.
async function handleScreenshotUpload({ from, account, mediaUrl, mediaContentType }) {
  try {
    const parsed = await parseScreenshot(mediaUrl, mediaContentType)
    const { error } = await supabase.from('screenshot_uploads').insert({
      account_id: account.id,
      merchant_name: parsed.merchant || null,
      category: parsed.category || 'unknown',
      items: parsed.items || [],
    })
    if (error) console.error('[rcs] failed to persist screenshot upload:', error.message)

    const label = parsed.merchant || `a ${parsed.category} spot`
    await sendRcsTurn(from, { text: `got it — ${label}. i'll watch this one.`, deals: [], quickReplies: [] })

    // Order matters: confirm prompt first (about *this* screenshot), then
    // the profile push (which may reference deals from earlier screenshots
    // too) — keeps the two messages in a sensible reading order.
    await maybeSendConfirmPrompt(from, parsed)
    await maybePushProfileMatches(from, account)
  } catch (err) {
    console.error('[rcs] screenshot parsing failed:', err.message)
    await sendRcsTurn(
      from,
      { text: "couldn't quite read that one — mind trying again with a clearer screenshot?", deals: [], quickReplies: [] },
    )
  }
}

async function handleConfirmReply({ from, confirmed }) {
  const pending = resolvePendingConfirmation(from)
  if (!pending) return // stray tap — no prompt is currently outstanding for this number

  if (confirmed) {
    await confirmMerchant(pending.merchantName, pending.category)
    await sendRcsTurn(from, { text: 'got it, thanks — that helps.', deals: [], quickReplies: [] })
  } else {
    await sendRcsTurn(from, { text: 'ok, noted — thanks for the correction.', deals: [], quickReplies: [] })
  }
}

router.post('/webhook', express.urlencoded({ extended: false }), async (req, res) => {
  const from = req.body.From
  const body = (req.body.Body || '').trim()
  const buttonPayload = req.body.ButtonPayload
  // Twilio's inbound-media convention (shared across MMS/RCS): NumMedia
  // count plus MediaUrl0/MediaContentType0 for the first attachment. Only
  // MediaUrl0 is handled — multi-image screenshots aren't a supported case
  // yet, matching the "one screenshot at a time" scope in BACKLOG.md.
  const numMedia = parseInt(req.body.NumMedia || '0', 10)
  const mediaUrl = numMedia > 0 ? req.body.MediaUrl0 : null
  const mediaContentType = numMedia > 0 ? req.body.MediaContentType0 : null

  res.status(200).end() // ack immediately; Twilio expects a fast response

  // Approval gate: only accounts Donald has approved get the real deals
  // experience. Pending/unknown numbers get pointed at the web landing page
  // instead — no buttonPayload handling, no matchDeals, no screenshot
  // parsing. The Twilio ack above already happened, so a failure here just
  // means no reply gets sent, not a response-timing problem.
  let phone
  let account
  try {
    phone = normalizePhone(from)
    if (!phone) {
      console.error('[rcs] failed to normalize inbound phone:', from)
      return
    }

    account = await resolveOrCreateAccount(phone)
    if (account.status !== 'approved') {
      await sendRcsTurn(from, {
        text: "hey — you're not signed up for Coop yet. sign up here: https://getcoop.cash and we'll get you in.",
        deals: [],
        quickReplies: [],
      })
      return
    }
  } catch (err) {
    console.error('[rcs] account resolution failed:', err.message)
    return
  }

  if (mediaUrl) {
    await handleScreenshotUpload({ from, account, mediaUrl, mediaContentType })
    return
  }

  if (buttonPayload === 'confirm_yes' || buttonPayload === 'confirm_no') {
    await handleConfirmReply({ from, confirmed: buttonPayload === 'confirm_yes' })
    return
  }

  if (buttonPayload?.startsWith('save_')) {
    const deal = resolveQuickReplyId(from, buttonPayload)
    if (deal) {
      // TODO: persist the save once there's a backing store (Supabase, per Calvin's
      // convention) — this only proves the round trip today.
      console.log(`[rcs] ${from} saved ${deal.id} (${deal.offer})`)
      await sendRcsTurn(from, { text: `saved — ${deal.offer}.`, deals: [], quickReplies: [] })
    }
    return
  }

  let deals
  try {
    deals = await fetchDeals()
  } catch (err) {
    console.error('[rcs] failed to fetch deals:', err.message)
    return
  }

  const matches = matchDeals(body || 'nearby', deals)
  const shown = matches.slice(0, 2)
  const turn = {
    text:
      shown.length > 0
        ? `found ${matches.length === 1 ? 'one' : matches.length} you haven't used yet.`
        : "not seeing that one in your regulars yet.",
    deals: shown,
    overflowCount: Math.max(0, matches.length - shown.length),
    quickReplies: quickReplies.slice(0, 4),
  }
  await sendRcsTurn(from, turn, { isFirstTurn: false })
})

export default router
