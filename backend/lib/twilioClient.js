import 'dotenv/config'
import twilio from 'twilio'
import { renderTurnAsRCS } from '../rcs/render.js'
import { recordTurn } from './session.js'

// Mirrors the guard style of family-hq/backend/lib/twilio.js: no-op (not throw) when
// credentials aren't configured yet, so the rest of the app can run without them during
// this sketch phase.
const client =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null

const templateSids = {
  card: process.env.RCS_TEMPLATE_CARD_SID,
  carousel: process.env.RCS_TEMPLATE_CAROUSEL_SID,
  chipsOpening: process.env.RCS_TEMPLATE_CHIPS_OPENING_SID,
  chipsFollowup: process.env.RCS_TEMPLATE_CHIPS_FOLLOWUP_SID,
  confirmMerchant: process.env.RCS_TEMPLATE_CONFIRM_MERCHANT_SID,
}

/**
 * Sends one AssistantTurn as an ordered sequence of RCS messages (prose -> card(s) ->
 * chips), via Twilio's Messaging Service — which auto-falls-back to SMS/MMS on devices
 * that don't support RCS, per Twilio's docs. Requires TWILIO_ACCOUNT_SID/AUTH_TOKEN,
 * TWILIO_MESSAGING_SERVICE_SID, and the four RCS_TEMPLATE_*_SID vars (from
 * `npm run provision:rcs`) to actually send; otherwise logs and returns without sending.
 */
export async function sendRcsTurn(to, turn, { isFirstTurn = false } = {}) {
  const messages = renderTurnAsRCS(turn, { templateSids, isFirstTurn })

  // Recorded regardless of whether a real send happens below, so the save-tap round trip
  // (routes/rcs.js -> resolveQuickReplyId) is exercisable in local/no-credentials testing too.
  if (turn.deals?.length) recordTurn(to, turn.deals)

  if (!client || !process.env.TWILIO_MESSAGING_SERVICE_SID) {
    console.log('[rcs] no Twilio credentials configured — would have sent:', JSON.stringify(messages, null, 2))
    return { sent: false, messages }
  }

  const results = []
  for (const msg of messages) {
    const payload =
      msg.kind === 'text'
        ? { body: msg.body }
        : { contentSid: msg.contentSid, contentVariables: JSON.stringify(msg.contentVariables) }

    results.push(
      await client.messages.create({
        ...payload,
        messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
        to,
      }),
    )
  }

  return { sent: true, results }
}

/**
 * Sends the confidence-gate confirm chip ("is this Chipotle?" / yes / no) — a single
 * template message, not a full AssistantTurn, so it doesn't go through renderTurnAsRCS.
 * Requires RCS_TEMPLATE_CONFIRM_MERCHANT_SID (from `npm run provision:rcs`); otherwise
 * logs and returns without sending, same no-credentials-yet guard as sendRcsTurn.
 */
export async function sendConfirmPrompt(to, questionText) {
  if (!client || !process.env.TWILIO_MESSAGING_SERVICE_SID || !templateSids.confirmMerchant) {
    console.log('[rcs] no Twilio credentials/template configured — would have sent confirm prompt:', questionText)
    return { sent: false }
  }

  return client.messages.create({
    contentSid: templateSids.confirmMerchant,
    contentVariables: JSON.stringify({ 1: questionText }),
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
    to,
  })
}
