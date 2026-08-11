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
 */
export async function sendAndLogEngagement({ account, slot, archetype, deal, templateId, turn }) {
  await sendRcsTurn(account.phone, turn)

  const { error } = await supabase.from('engagement_sends').insert({
    account_id: account.id,
    slot,
    archetype,
    deal_id: deal?.id || null,
    template_id: templateId,
    status: 'sent',
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
