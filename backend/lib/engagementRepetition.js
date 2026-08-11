import { supabase } from './supabase.js'

// Story A5 — excludes candidates whose deal was already sent to this account within a
// recent window, falling through to the next-best scored candidate. If the whole pool is
// excluded, that's a suppression (no eligible inventory left, distinct from "nothing
// scored well") — this module signals that by returning null, and the caller
// (engagementSuppression.js / engagementSend.js) is responsible for turning a null into an
// `inventory_floor` suppression reason, not this file (this file's job is picking, not
// suppression bookkeeping).

const DEFAULT_REPETITION_WINDOW_DAYS = 14

/**
 * accountId: uuid. windowDays: how far back "recently sent" looks. Returns a Set of
 * deal_id strings sent to this account within the window, status='sent' only — a
 * suppressed/would_have_sent row never actually reached the user, so it shouldn't count
 * against repetition.
 */
export async function recentlySentDealIds(accountId, windowDays = DEFAULT_REPETITION_WINDOW_DAYS) {
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString()
  const { data, error } = await supabase
    .from('engagement_sends')
    .select('deal_id')
    .eq('account_id', accountId)
    .eq('status', 'sent')
    .gte('sent_at', since)
  if (error) {
    console.error('[engagementRepetition] lookup failed — failing safe (treating as no history):', error.message)
    return new Set()
  }
  return new Set(data.map((row) => row.deal_id).filter(Boolean))
}

/**
 * Pure filtering step, separated from the DB lookup above so it's directly unit-testable
 * without credentials (see engagementRepetition.test.js) — matches this codebase's
 * convention of keeping the I/O boundary thin and the decision logic pure. `scored` is
 * engagementScoring.js's ranked output (best-first); `excludedDealIds` is typically the
 * Set from recentlySentDealIds above. Returns the best candidate not in the excluded set,
 * or null if every scored candidate has already been sent recently (inventory floor).
 */
export function pickNextBestUnrepeated(scored, excludedDealIds) {
  for (const candidate of scored) {
    if (!excludedDealIds.has(candidate.deal.id)) return candidate
  }
  return null
}
