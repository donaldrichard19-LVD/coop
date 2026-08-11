import { supabase } from './supabase.js'

// Story A12 — opt-out attribution: read-only query helpers joining opt_out_records to
// engagement_sends. No new table, per the plan — everything here is derived/aggregated
// from the two tables A0 already created. Mirrors lib/deals.js's shape (plain async
// query functions, no class/service wrapper) rather than inventing a new module style.

/**
 * For a given account, pairs each opt-out event with the engagement_sends row that most
 * plausibly preceded it — via last_send_id when it was captured at write time (A8/A10 both
 * pass it when available), falling back to "most recent sent row before this opt-out's
 * timestamp" otherwise. Gives slot/deal/merchant/time attribution per opt-out.
 */
export async function optOutAttribution(accountId) {
  const { data: optOuts, error: optOutError } = await supabase
    .from('opt_out_records')
    .select('id, type, keyword_matched, created_at, last_send_id')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true })
  if (optOutError) throw optOutError

  const results = []
  for (const optOut of optOuts) {
    let attributedSend = null
    if (optOut.last_send_id) {
      const { data } = await supabase.from('engagement_sends').select('*').eq('id', optOut.last_send_id).maybeSingle()
      attributedSend = data
    }
    if (!attributedSend) {
      const { data } = await supabase
        .from('engagement_sends')
        .select('*')
        .eq('account_id', accountId)
        .eq('status', 'sent')
        .lte('sent_at', optOut.created_at)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      attributedSend = data
    }
    results.push({ optOut, attributedSend })
  }
  return results
}

/**
 * Opt-out rate by day-of-week the preceding send went out on — engagement_sends' own
 * `slot` field is a per-account per-day string (e.g. "2026-08-11"), not a generic weekday
 * bucket, so this aggregates by day-of-week derived from sent_at instead, which is what
 * "rate by slot" actually needs to be actionable (P0's fixed schedule only ever uses
 * Monday/Thursday, so in practice only those two buckets will have data).
 */
export async function optOutRateBySlot() {
  const { data: sends, error: sendsError } = await supabase
    .from('engagement_sends')
    .select('account_id, sent_at')
    .eq('status', 'sent')
  if (sendsError) throw sendsError

  const { data: hardOptOuts, error: optOutError } = await supabase.from('opt_out_records').select('account_id').eq('type', 'hard')
  if (optOutError) throw optOutError
  const optedOutAccountIds = new Set(hardOptOuts.map((r) => r.account_id))

  const byDay = {}
  for (const send of sends) {
    const day = new Date(send.sent_at).getDay()
    byDay[day] = byDay[day] || { sends: 0, optedOutAccountIds: new Set() }
    byDay[day].sends += 1
    if (optedOutAccountIds.has(send.account_id)) byDay[day].optedOutAccountIds.add(send.account_id)
  }

  return Object.fromEntries(
    Object.entries(byDay).map(([day, stats]) => [
      day,
      {
        sends: stats.sends,
        optedOutAccounts: stats.optedOutAccountIds.size,
        rate: stats.sends > 0 ? stats.optedOutAccountIds.size / stats.sends : 0,
      },
    ]),
  )
}

/** Global soft:hard opt-out ratio across all accounts. */
export async function softToHardOptOutRatio() {
  const { data, error } = await supabase.from('opt_out_records').select('type')
  if (error) throw error
  const soft = data.filter((r) => r.type === 'soft').length
  const hard = data.filter((r) => r.type === 'hard').length
  return { soft, hard, ratio: hard > 0 ? soft / hard : null }
}

/**
 * "Sends since engagement" for a given account — mirrors engagement_preferences'
 * consecutive_non_engaged_sends counter (Story A11) directly rather than recomputing it
 * from the raw send log, since A11 already maintains exactly this number as sends happen.
 */
export async function sendsSinceLastEngagement(accountId) {
  const { data, error } = await supabase
    .from('engagement_preferences')
    .select('consecutive_non_engaged_sends')
    .eq('account_id', accountId)
    .maybeSingle()
  if (error) throw error
  return data?.consecutive_non_engaged_sends ?? 0
}
