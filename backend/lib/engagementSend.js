import { supabase } from './supabase.js'
import { sendRcsTurn } from './twilioClient.js'

// Story A7 — the actual send + logging step, last in the A2 -> A3 -> A4 -> A5 -> A6 -> A7
// pipeline. Calls the existing sendRcsTurn unchanged (per the plan) so a rendered
// engagement turn goes out through exactly the same code path as every other outbound
// message in this codebase, including its credential-less no-op fallback.

/**
 * Writes a suppressed-send row (Story A2's outcome) — no message is rendered or sent for
 * these, per the plan ("Suppressed sends do not get a 'sent' status row" — status here is
 * 'suppressed', a distinct value).
 */
export async function logSuppressedSend({ accountId, slot, reason }) {
  const { error } = await supabase
    .from('engagement_sends')
    .insert({ account_id: accountId, slot, status: 'suppressed', suppression_reason: reason })
  if (error) console.error('[engagementSend] failed to log suppressed send:', error.message)
}

/**
 * Sends the given AssistantTurn via sendRcsTurn and logs the outcome to engagement_sends.
 * status is 'sent' whether or not real Twilio credentials are configured — sendRcsTurn's
 * own credential-less no-op ("would have sent") still represents a completed pipeline
 * decision from this module's point of view; the *absence* of credentials is an
 * infrastructure concern logged by twilioClient.js itself, not something engagementSend.js
 * should encode as a different outcome status (that's what the reserved
 * 'would_have_sent' status is for instead — a future dry-run mode, not this).
 *
 * merchant_name (Story P2-4) and is_control_group (Story P2-5) are denormalized onto this
 * row at send time — see engagement_sends' column comments for why (repetition-penalty
 * lookups and later control/treatment comparison queries, respectively, both want to avoid
 * re-joining against tables whose contents rotate or whose current value may differ from
 * what was true at send time).
 */
export async function sendAndLogEngagement({ account, slot, archetype, deal, templateId, turn, isControlGroup }) {
  const result = await sendRcsTurn(account.phone, turn)
  // Only populated on a real send (result.sent === true) — the credential-less no-op
  // returns { sent: false, messages } with no Twilio Message resources to pull a sid from.
  // Feeds message_delivery_status joins once the status-callback webhook is receiving
  // anything real — see engagement_sends.message_sids' column comment.
  const messageSids = result.sent ? result.results.map((r) => r.sid).filter(Boolean) : []

  const { error } = await supabase.from('engagement_sends').insert({
    account_id: account.id,
    slot,
    archetype,
    deal_id: deal?.id || null,
    merchant_name: deal?.merchant?.name || null,
    template_id: templateId,
    status: 'sent',
    is_control_group: !!isControlGroup,
    message_sids: messageSids,
  })
  if (error) console.error('[engagementSend] failed to log sent engagement:', error.message)
}

/**
 * Most-recently-used template id for this account, across any slot — feeds
 * engagementRender.js's lastTemplateId rotation input (Story A6). Only looks at 'sent'
 * rows, same reasoning as engagementRepetition.js's recentlySentDealIds.
 */
export async function lastUsedTemplateId(accountId) {
  const { data, error } = await supabase
    .from('engagement_sends')
    .select('template_id')
    .eq('account_id', accountId)
    .eq('status', 'sent')
    .not('template_id', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[engagementSend] last-template lookup failed:', error.message)
    return null
  }
  return data?.template_id || null
}

/**
 * Story P2-4 — the account's most-recently-sent deal's merchant name, read directly from
 * engagement_sends' denormalized merchant_name column (see that column's comment) rather
 * than re-resolving a past deal_id against the current, rotating deals inventory. Only
 * looks at 'sent' rows, same reasoning as recentlySentDealIds/lastUsedTemplateId. Feeds
 * lib/engagementScoring.js's soft merchant-repetition penalty.
 */
export async function lastSentMerchantName(accountId) {
  const { data, error } = await supabase
    .from('engagement_sends')
    .select('merchant_name')
    .eq('account_id', accountId)
    .eq('status', 'sent')
    .not('merchant_name', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[engagementSend] last-merchant lookup failed:', error.message)
    return null
  }
  return data?.merchant_name || null
}

/**
 * Idempotency check for Story A1's scheduler: has this account already got a
 * sent/suppressed row for today's slot, so a crash-retry doesn't double-send. `slot` is a
 * caller-defined string identifying the day's send (e.g. "2026-08-11" or
 * "2026-08-11-monday") — the scheduler owns what a "slot" string means; this function just
 * checks for an existing row with that exact value.
 */
export async function hasAlreadyAttemptedSlot(accountId, slot) {
  const { data, error } = await supabase
    .from('engagement_sends')
    .select('id')
    .eq('account_id', accountId)
    .eq('slot', slot)
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[engagementSend] idempotency check failed — failing safe (treating as already attempted):', error.message)
    return true
  }
  return !!data
}
