import express from 'express'
import { quickReplies } from '../../src/data/deals.js'
import { fetchDeals } from '../lib/deals.js'
import { sendRcsTurn, sendConfirmPrompt } from '../lib/twilioClient.js'
import { resolveQuickReplyId, getLastTurnDeals, getLastTurnText } from '../lib/session.js'
import { setPendingConfirmation, resolvePendingConfirmation } from '../lib/pendingConfirmations.js'
import { normalizePhone, resolveOrCreateAccount } from '../lib/accounts.js'
import { parseScreenshot } from '../lib/screenshotParser.js'
import { confirmMerchant } from '../lib/merchantDictionary.js'
import { getPreferenceProfile, MIN_UPLOADS_FOR_PROFILE } from '../lib/preferenceProfile.js'
import { matchDealsToProfile } from '../lib/profileDealMatch.js'
import { supabase } from '../lib/supabase.js'
import { handleComplianceMessage, isHardOptedOut } from '../lib/optOut.js'
import { classifyInbound, cannedMetaAnswer } from '../lib/inboundClassifier.js'
import { classifySoftOptOut, applySoftOptOut, mightBeNegativeFeedback, applyAmbiguousNegativeFeedback } from '../lib/softOptOut.js'
import { handleOnDemandRequest } from '../lib/onDemandRetrieval.js'
import { recordEngagedSend } from '../lib/cadenceDecay.js'

const router = express.Router()

// A message plausibly refers back anaphorically to the last thing we sent ("anything
// cheaper than THAT", "is THIS one still around") — used to decide whether
// lib/intentExtraction.js (A13) should be given the last outbound text at all, per its own
// explicit scoping ("last outbound message only if referenced anaphorically").
const ANAPHORIC_REFERENCE_RE = /\b(that|it|this one|those|these)\b/i

// Twilio's inbound webhook for both freeform replies and button/chip taps. Button taps
// arrive with a ButtonPayload (the `id` we set in rcs/templates.js, e.g. "save_0") in
// addition to Body — the exact inbound field names should be confirmed against a live
// payload in Twilio's console before this goes further; this is the shape documented for
// WhatsApp/RCS quick replies and is treated as provisional here.

// Story B5 — was originally a one-time push, firing exactly on the upload that crossed
// MIN_UPLOADS_FOR_PROFILE. Now runs on every upload past that threshold (not just the one
// that first crosses it), tracking what's already been shown via surfaced_deals so a
// repeat upload doesn't re-push a deal the account has already seen, and — since Story A8
// exists in this same build pass — checks isHardOptedOut first, same opt-out state both
// proactive-send paths (this one and A1's scheduler) must honor.
async function maybePushProfileMatches(from, account) {
  if (await isHardOptedOut(account.id)) return

  let profile
  try {
    profile = await getPreferenceProfile(account.id)
  } catch (err) {
    console.error('[rcs] failed to load preference profile:', err.message)
    return
  }
  if (!profile.isReady) return // below MIN_UPLOADS_FOR_PROFILE — nothing to push on any upload yet

  let deals
  try {
    deals = await fetchDeals()
  } catch (err) {
    console.error('[rcs] failed to fetch deals for profile match:', err.message)
    return
  }

  const matches = matchDealsToProfile(deals, profile)
  if (matches.length === 0) return

  const { data: surfacedRows, error: surfacedError } = await supabase
    .from('surfaced_deals')
    .select('deal_id')
    .eq('account_id', account.id)
  if (surfacedError) console.error('[rcs] failed to load surfaced_deals:', surfacedError.message)
  const alreadySurfaced = new Set((surfacedRows || []).map((r) => r.deal_id))

  const newMatches = matches.filter((d) => !alreadySurfaced.has(d.id))
  if (newMatches.length === 0) return

  // "you're all set" framing only makes sense the first time this ever fires for an
  // account; every push after that uses a plainer "found something new" framing.
  const isFirstPush = profile.uploadCount === MIN_UPLOADS_FOR_PROFILE
  await sendRcsTurn(from, {
    text: isFirstPush
      ? `you're all set — found ${newMatches.length === 1 ? 'one' : newMatches.length} based on what you've been ordering.`
      : `found ${newMatches.length === 1 ? 'another one' : `${newMatches.length} more`} based on what you've been ordering.`,
    deals: newMatches,
    quickReplies: quickReplies.slice(0, 4),
  })

  const { error: insertError } = await supabase
    .from('surfaced_deals')
    .upsert(
      newMatches.map((d) => ({ account_id: account.id, deal_id: d.id })),
      { onConflict: 'account_id,deal_id', ignoreDuplicates: true },
    )
  if (insertError) console.error('[rcs] failed to record surfaced_deals:', insertError.message)
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
      order_timestamp: parsed.orderTimestamp || null,
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

// Story A9's fallback bucket ("search request or unclassifiable") is where A10's soft
// opt-out ladder and A14's on-demand retrieval both live — A10 first (an explicit soft
// opt-out signal takes priority over treating the message as a new search), then A14.
// classifySoftOptOut only checked here, not earlier in the A9 dispatch chain, because it's
// specifically about messages that don't cleanly classify as anything else (an
// acknowledgment or a meta-question wouldn't also be a "too many texts" complaint in the
// same breath in practice).
async function handleSearchOrUnclassifiable({ from, account, body }) {
  const lastDeals = getLastTurnDeals(from) || []
  const lastDeal = lastDeals[0] || null

  const ladderMatch = classifySoftOptOut(body)
  if (ladderMatch) {
    const { message } = await applySoftOptOut({ account, action: ladderMatch.action, keyword: ladderMatch.keyword, body, lastSentDeal: lastDeal })
    if (message) {
      await sendRcsTurn(from, { text: message, deals: [], quickReplies: [] })
      return
    }
    // acknowledged: false (e.g. exclude_category/exclude_merchant with no lastSentDeal to
    // attach the exclusion to) — fall through to on-demand retrieval instead of going silent.
  } else if (mightBeNegativeFeedback(body)) {
    const { message } = await applyAmbiguousNegativeFeedback({ account, body })
    if (message) {
      await sendRcsTurn(from, { text: message, deals: [], quickReplies: [] })
      return
    }
    // classified as not-actually-negative — fall through to on-demand retrieval.
  }

  let profile
  try {
    profile = await getPreferenceProfile(account.id)
  } catch (err) {
    console.error('[rcs] failed to load preference profile for on-demand retrieval:', err.message)
    profile = null
  }

  const lastOutboundText = getLastTurnText(from)
  const isAnaphoric = lastOutboundText && ANAPHORIC_REFERENCE_RE.test(body)

  try {
    const turn = await handleOnDemandRequest({
      message: body,
      profile,
      timezone: account.timezone,
      lastOutboundText: isAnaphoric ? lastOutboundText : null,
      account,
    })
    await sendRcsTurn(from, turn)
  } catch (err) {
    console.error('[rcs] on-demand retrieval failed:', err.message)
    await sendRcsTurn(from, { text: "having trouble finding that right now — try again in a bit?", deals: [], quickReplies: [] })
  }
}

// Story A9 dispatch: routes a freeform inbound message (already past A8's compliance
// check and the account-approval gate) to the right handler based on classifyInbound's
// bucket. This is the replacement for the old unconditional matchDeals(body) fallback —
// every inbound text now goes through this classifier first.
async function handleFreeformMessage({ from, account, body }) {
  const hasPendingTurn = (getLastTurnDeals(from) || []).length > 0
  const classification = classifyInbound(body, { hasPendingTurn })

  switch (classification.type) {
    case 'compliance':
      // Defensive safety net only — lib/optOut.js's handleComplianceMessage already ran
      // (and would have returned) before this function is ever reached. Nothing to do.
      return
    case 'acknowledgment':
      // "canned/no reply" per the plan — deliberately no reply at all, avoids an
      // awkward bot-to-bot "you're welcome" loop.
      return
    case 'offer_reply': {
      const deals = getLastTurnDeals(from) || []
      const deal = deals[classification.ordinal]
      if (deal) {
        // TODO: persist the save once there's a backing store (Supabase, per Calvin's
        // convention) — this only proves the round trip today, same as the button-tap path.
        console.log(`[rcs] ${from} saved ${deal.id} (${deal.offer}) via freeform offer reply`)
        await sendRcsTurn(from, { text: `saved — ${deal.offer}.`, deals: [], quickReplies: [] })
        return
      }
      // hasPendingTurn was true but the specific ordinal was out of range — fall through
      // to on-demand retrieval rather than going silent.
      await handleSearchOrUnclassifiable({ from, account, body })
      return
    }
    case 'meta_question':
      await sendRcsTurn(from, { text: cannedMetaAnswer(classification.question), deals: [], quickReplies: [] })
      return
    case 'search_or_unclassifiable':
    default:
      await handleSearchOrUnclassifiable({ from, account, body })
      return
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

  // Account resolution (phone -> accounts row, creating a pending one if needed) is the
  // minimal lookup Story A8's compliance check needs an account_id for — it is
  // deliberately NOT gated behind approval status or wrapped in any other inbound logic,
  // since the very next thing that runs on the resolved account must be the compliance
  // check, before anything else.
  let phone
  let account
  try {
    phone = normalizePhone(from)
    if (!phone) {
      console.error('[rcs] failed to normalize inbound phone:', from)
      return
    }
    account = await resolveOrCreateAccount(phone)
  } catch (err) {
    console.error('[rcs] account resolution failed:', err.message)
    return
  }

  // Story A8 — the P0 hard compliance blocker. Must run before any model call, before any
  // other inbound logic, and before the account-approval gate below. Fully handles
  // STOP/START/HELP itself (including sending the one required confirmation) when it
  // matches; returns true in that case, and nothing else in this handler runs.
  try {
    const handledAsCompliance = await handleComplianceMessage({ phone: from, account, body })
    if (handledAsCompliance) return
  } catch (err) {
    console.error('[rcs] compliance handling failed:', err.message)
    return
  }

  // Approval gate: only accounts Donald has approved get the real deals
  // experience. Pending/unknown numbers get pointed at the web landing page
  // instead — no buttonPayload handling, no matchDeals, no screenshot
  // parsing. The Twilio ack above already happened, so a failure here just
  // means no reply gets sent, not a response-timing problem.
  if (account.status !== 'approved') {
    await sendRcsTurn(from, {
      text: "hey — you're not signed up for Coop yet. sign up here: https://getcoop.cash and we'll get you in.",
      deals: [],
      quickReplies: [],
    })
    return
  }

  // Story A11 — any non-compliance inbound message counts as engagement (bare
  // acknowledgments included, per the confirmed rule reconciling A9's classifier with
  // A11's own accounting — both now agree an acknowledgment is a positive signal).
  // Compliance messages (STOP/HELP/etc.) already returned above and never reach this line.
  // Single call site, right after the approval gate, covers every dispatch branch below
  // (screenshot upload, button taps, and handleFreeformMessage's classifier dispatch).
  try {
    await recordEngagedSend(account.id)
  } catch (err) {
    console.error('[rcs] failed to record engaged send:', err.message)
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

  // Story A9 — every remaining freeform text message is classified first (compliance /
  // acknowledgment / offer_reply / meta_question / search_or_unclassifiable), replacing
  // the old unconditional matchDeals(body) call with a proper dispatch. See
  // handleFreeformMessage above for the full routing table, including A10's soft opt-out
  // ladder and A14's on-demand retrieval, both reached via the search_or_unclassifiable
  // bucket.
  await handleFreeformMessage({ from, account, body })
})

export default router
