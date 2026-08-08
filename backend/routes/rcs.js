import express from 'express'
import { matchDeals, quickReplies } from '../../src/data/deals.js'
import { sendRcsTurn } from '../lib/twilioClient.js'
import { resolveQuickReplyId } from '../lib/session.js'

const router = express.Router()

// Twilio's inbound webhook for both freeform replies and button/chip taps. Button taps
// arrive with a ButtonPayload (the `id` we set in rcs/templates.js, e.g. "save_0") in
// addition to Body — the exact inbound field names should be confirmed against a live
// payload in Twilio's console before this goes further; this is the shape documented for
// WhatsApp/RCS quick replies and is treated as provisional here.
router.post('/webhook', express.urlencoded({ extended: false }), async (req, res) => {
  const from = req.body.From
  const body = (req.body.Body || '').trim()
  const buttonPayload = req.body.ButtonPayload

  res.status(200).end() // ack immediately; Twilio expects a fast response

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

  const matches = matchDeals(body || 'nearby')
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
