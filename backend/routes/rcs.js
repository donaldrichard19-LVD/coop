import express from 'express'
import { matchDeals, quickReplies } from '../../src/data/deals.js'
import { fetchDeals } from '../lib/deals.js'
import { sendRcsTurn } from '../lib/twilioClient.js'
import { resolveQuickReplyId } from '../lib/session.js'
import { normalizePhone, resolveOrCreateAccount } from '../lib/accounts.js'
import { parseScreenshot } from '../lib/screenshotParser.js'
import { supabase } from '../lib/supabase.js'

const router = express.Router()

// Twilio's inbound webhook for both freeform replies and button/chip taps. Button taps
// arrive with a ButtonPayload (the `id` we set in rcs/templates.js, e.g. "save_0") in
// addition to Body — the exact inbound field names should be confirmed against a live
// payload in Twilio's console before this goes further; this is the shape documented for
// WhatsApp/RCS quick replies and is treated as provisional here.
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
  } catch (err) {
    console.error('[rcs] screenshot parsing failed:', err.message)
    await sendRcsTurn(
      from,
      { text: "couldn't quite read that one — mind trying again with a clearer screenshot?", deals: [], quickReplies: [] },
    )
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
