import { supabase } from './supabase.js'
import { defaultEngagementPreferences, getEngagementPreferences } from './engagementSuppression.js'

// Story P2-3 — third weekly send, earned via a rolling (continuously re-evaluated, not
// permanent) window of the account's last 3 scheduled status='sent' engagement_sends rows.
//
// Per-send engagement attribution: cadenceDecay.js's existing model tracks a single rolling
// last_engaged_at timestamp per account, not a full per-event engagement log (see that
// file's own documented limitation on evaluateSendEngagement). This module reuses that same
// signal rather than inventing a second, different notion of "engaged": a given send in the
// window counts as engaged if last_engaged_at falls inside THAT send's own window —
// [sent_at, nextSend.sent_at) for every send except the most recent, which uses
// [sent_at, now) since there is no "next" send yet to bound it.
//
// This is an approximation, not true per-send attribution — a single reply can only ever
// "belong" to one window by construction, but if an account received two sends close
// together and then replied once, the reply is attributed to whichever window it falls in
// chronologically, which may or may not be the send the account was actually reacting to.
// Accepted for the same reason cadenceDecay.js accepts its own version of this limitation:
// this is a rolling heuristic feeding a continuously re-evaluated earn/lose gate (not a
// one-time permanent decision), so a single misattributed window self-corrects the next
// time the 3-send window slides forward.

/**
 * Pure. sentAt/nextSentAt/lastEngagedAt are ISO strings (or Date-parseable values);
 * nextSentAt is null for the most recent send in the window, in which case `now` bounds the
 * window instead.
 */
export function isSendWindowEngaged({ sentAt, nextSentAt, lastEngagedAt, now = new Date() }) {
  if (!lastEngagedAt) return false
  const windowStart = new Date(sentAt)
  const windowEnd = nextSentAt ? new Date(nextSentAt) : now
  const engagedAt = new Date(lastEngagedAt)
  return engagedAt >= windowStart && engagedAt < windowEnd
}

/**
 * Pure. `sends` is the account's last <=3 status='sent' rows, each { sent_at }, sorted
 * ASCENDING (oldest first) — sorting/limiting to 3 is the caller's responsibility so this
 * function stays a plain array-in, boolean-out decision. Returns true (earned) if at least
 * one of them was engaged per isSendWindowEngaged above.
 */
export function evaluateThirdSendEligibility({ sends, lastEngagedAt, now = new Date() }) {
  for (let i = 0; i < sends.length; i++) {
    const nextSentAt = sends[i + 1]?.sent_at ?? null
    if (isSendWindowEngaged({ sentAt: sends[i].sent_at, nextSentAt, lastEngagedAt, now })) return true
  }
  return false
}

async function upsertPreferences(accountId, patch) {
  const current = await getEngagementPreferences(accountId)
  const next = { ...defaultEngagementPreferences(accountId), ...current, ...patch, updated_at: new Date().toISOString() }
  const { error } = await supabase.from('engagement_preferences').upsert(next, { onConflict: 'account_id' })
  if (error) console.error('[thirdSendEligibility] failed to upsert engagement_preferences:', error.message)
  return next
}

/**
 * Fetches an account's last 3 sent engagement_sends rows and its current preferences,
 * evaluates the rolling eligibility window, and writes engagement_preferences.earned_third_send
 * only when it actually changed (avoids a no-op write on every tick for every account).
 * Control-group accounts (Story P2-5) are skipped entirely — they never earn a 3rd send,
 * checked here once rather than duplicated at every call site that reads earned_third_send.
 *
 * Deliberately does NOT look at cadence_tier here: decay and earning are independent axes
 * by design (see engagement_preferences.earned_third_send's column comment) — the decay
 * gate is applied separately, at read time, by engagementScheduler.js#effectiveSendCount.
 */
export async function reevaluateThirdSendEligibility(accountId) {
  const prefs = await getEngagementPreferences(accountId)
  if (prefs.is_control_group) return

  const { data: sends, error } = await supabase
    .from('engagement_sends')
    .select('sent_at')
    .eq('account_id', accountId)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(3)
  if (error) {
    console.error(`[thirdSendEligibility] failed to load recent sends for ${accountId}:`, error.message)
    return
  }

  const ascending = [...sends].reverse()
  const earned = evaluateThirdSendEligibility({ sends: ascending, lastEngagedAt: prefs.last_engaged_at })

  if (earned === prefs.earned_third_send) return
  console.log(`[thirdSendEligibility] account ${accountId}: earned_third_send ${prefs.earned_third_send} -> ${earned}`)
  await upsertPreferences(accountId, { earned_third_send: earned })
}

async function fetchApprovedAccountIds() {
  const { data, error } = await supabase.from('accounts').select('id').eq('status', 'approved')
  if (error) {
    console.error('[thirdSendEligibility] failed to load approved accounts:', error.message)
    return []
  }
  return data.map((row) => row.id)
}

/**
 * Wired into engagementScheduler.js's daily cron tick, alongside cadenceDecay.js's
 * sweepNonEngagement — runs unconditionally every tick (not gated by any particular send
 * day), re-evaluating every approved account's rolling 3-send window fresh each time, per
 * the plan's "continuously re-evaluated, not a permanent unlock" requirement. Isolates
 * per-account failures, same convention as engagementScheduler.js#runEngagementBatch.
 */
export async function reevaluateAllThirdSendEligibility() {
  const accountIds = await fetchApprovedAccountIds()
  for (const accountId of accountIds) {
    try {
      await reevaluateThirdSendEligibility(accountId)
    } catch (err) {
      console.error(`[thirdSendEligibility] account ${accountId} failed, continuing:`, err.message)
    }
  }
}
