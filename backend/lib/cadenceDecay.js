import { supabase } from './supabase.js'
import { defaultEngagementPreferences, getEngagementPreferences } from './engagementSuppression.js'
import { maybeFireOffRamp } from './offRamp.js'

// Story A11 — cadence decay: 4 consecutive non-engaged scheduled sends steps the cadence
// tier down, same direction as A10's manual "too many" reduction (reuses the same
// CADENCE_STEP_DOWN idea, kept local here rather than imported from softOptOut.js since
// that module is about user-initiated feedback and this one is purely send-outcome-driven —
// different trigger, same tier-stepping vocabulary). Cadence is NOT auto-restored on
// re-engagement, per the plan — that stays a user-chosen action (currently only reachable
// today via a future preferences UI/command; nothing in this build pass raises the tier
// back up automatically).
//
// Engagement rule (confirmed): ANY inbound message from an account counts as engagement —
// including bare acknowledgments, offer replies, meta-questions, search-shaped messages,
// button taps, and screenshot uploads. The only exception is a compliance keyword
// (STOP/HELP/etc.), which is handled entirely by lib/optOut.js's dedicated path and never
// calls recordEngagedSend. This keeps A9's classifier (which already treats an
// acknowledgment as a positive signal) consistent with A11's own accounting, rather than
// having two different definitions of "engaged" in the same codebase. See routes/rcs.js
// for the single call site.

export const CADENCE_DECAY_THRESHOLD = 4

// Story A11's non-engagement sweep window: a scheduled send with zero inbound activity
// from that account in the 48 hours after sent_at counts as non-engaged.
export const NON_ENGAGEMENT_WINDOW_HOURS = 48

const CADENCE_STEP_DOWN = { standard: 'reduced', reduced: 'minimal', minimal: 'minimal' }

async function upsertPreferences(accountId, patch) {
  const current = await getEngagementPreferences(accountId)
  const next = { ...defaultEngagementPreferences(accountId), ...current, ...patch, updated_at: new Date().toISOString() }
  const { error } = await supabase.from('engagement_preferences').upsert(next, { onConflict: 'account_id' })
  if (error) console.error('[cadenceDecay] failed to upsert engagement_preferences:', error.message)
  return next
}

/**
 * Called by the non-engagement sweep (sweepNonEngagement, below) when a scheduled send's
 * 48-hour window has fully elapsed with no inbound activity from the account.
 * Increments consecutive_non_engaged_sends; once it reaches CADENCE_DECAY_THRESHOLD, steps
 * the cadence tier down one notch and resets the counter, logging the decay event.
 */
export async function recordNonEngagedSend(accountId) {
  const current = await getEngagementPreferences(accountId)
  const nextCount = (current.consecutive_non_engaged_sends || 0) + 1

  if (nextCount >= CADENCE_DECAY_THRESHOLD) {
    const nextTier = CADENCE_STEP_DOWN[current.cadence_tier] || 'reduced'
    console.log(
      `[cadenceDecay] account ${accountId}: ${nextCount} consecutive non-engaged sends -> stepping cadence ${current.cadence_tier} -> ${nextTier}`,
    )
    return upsertPreferences(accountId, { cadence_tier: nextTier, consecutive_non_engaged_sends: 0 })
  }

  return upsertPreferences(accountId, { consecutive_non_engaged_sends: nextCount })
}

/**
 * Called from routes/rcs.js for every non-compliance inbound message (see the confirmed
 * engagement rule above). Resets consecutive_non_engaged_sends to 0 and stamps
 * last_engaged_at to now — the latter is what sweepNonEngagement checks a scheduled send's
 * 48-hour window against. Always writes (no early-return-if-already-0 shortcut, unlike an
 * earlier version of this function): last_engaged_at needs to reflect the actual most
 * recent engagement time even when the counter was already 0, since the sweep depends on
 * it being accurate, not just the counter.
 *
 * Also nulls off_ramp_sent_at (Story P2-1) — a fresh engagement resets the non-engagement
 * streak entirely, so a later streak should be able to trigger the off-ramp offer again
 * rather than staying permanently suppressed by a stamp from a long-past streak.
 */
export async function recordEngagedSend(accountId) {
  return upsertPreferences(accountId, {
    consecutive_non_engaged_sends: 0,
    last_engaged_at: new Date().toISOString(),
    off_ramp_sent_at: null,
  })
}

/**
 * Pure. Given a scheduled send's sent_at and an account's last_engaged_at (nullable, from
 * engagement_preferences), decides whether the send's 48-hour window has fully elapsed
 * (ready) and, if so, whether it counts as engaged — i.e. last_engaged_at falls within
 * [sent_at, sent_at + 48h]. Extracted as a pure, testable function (see
 * cadenceDecay.test.js) even though the sweep's DB I/O around it isn't — matches this
 * codebase's pure-decision-core convention (engagementSuppression.js, lib/optOut.js).
 *
 * Known limitation, documented plainly rather than overclaiming: last_engaged_at is a
 * single rolling timestamp per account, not a full per-event log. If an account has
 * multiple backlogged unevaluated sends, this checks all of them against the same latest
 * engagement timestamp rather than reconstructing exactly which reply was "for" which
 * send — acceptable given the sweep runs on every scheduler cron tick (daily) and P0's
 * cadence is only two sends/week, so a meaningful backlog should be rare in practice.
 */
export function evaluateSendEngagement({ sentAt, lastEngagedAt, now = new Date() }) {
  const sentAtDate = new Date(sentAt)
  const windowEndDate = new Date(sentAtDate.getTime() + NON_ENGAGEMENT_WINDOW_HOURS * 3_600_000)
  if (now < windowEndDate) return { ready: false }

  if (!lastEngagedAt) return { ready: true, engaged: false }
  const lastEngagedDate = new Date(lastEngagedAt)
  const engaged = lastEngagedDate >= sentAtDate && lastEngagedDate <= windowEndDate
  return { ready: true, engaged }
}

async function markEvaluated(sendId) {
  const { error } = await supabase.from('engagement_sends').update({ non_engagement_evaluated: true }).eq('id', sendId)
  if (error) console.error(`[cadenceDecay] sweep: failed to mark send ${sendId} evaluated:`, error.message)
}

/**
 * Story A11's time-based sweep — wired into engagementScheduler.js's existing daily cron
 * tick (not a second scheduled job), runs unconditionally every tick regardless of whether
 * today is a send day, since it evaluates PAST sends whose windows may elapse on any day.
 *
 * Loads every status='sent', non_engagement_evaluated=false row whose 48-hour window has
 * already fully elapsed (sent_at <= now - 48h — filtered at the query level so this never
 * re-scans the whole send history), groups by account to fetch each account's
 * last_engaged_at once rather than once per send, then decides + records each one via
 * evaluateSendEngagement. Non-engaged sends call recordNonEngagedSend (increments the decay
 * counter); engaged sends do NOT call recordEngagedSend again here — the real-time call
 * from routes/rcs.js already reset the counter and stamped last_engaged_at when the reply
 * actually arrived, so this only needs to mark the row evaluated. Every row, engaged or
 * not, gets marked evaluated exactly once so a later tick never reprocesses it.
 */
export async function sweepNonEngagement(now = new Date()) {
  const cutoff = new Date(now.getTime() - NON_ENGAGEMENT_WINDOW_HOURS * 3_600_000).toISOString()
  const { data: sends, error } = await supabase
    .from('engagement_sends')
    .select('id, account_id, sent_at')
    .eq('status', 'sent')
    .eq('non_engagement_evaluated', false)
    .lte('sent_at', cutoff)
  if (error) {
    console.error('[cadenceDecay] sweep: failed to load unevaluated sends:', error.message)
    return
  }
  if (sends.length === 0) return

  console.log(`[cadenceDecay] sweep: evaluating ${sends.length} send(s) whose 48h window has elapsed`)

  const accountIds = [...new Set(sends.map((s) => s.account_id))]
  const lastEngagedByAccount = new Map()
  for (const accountId of accountIds) {
    const prefs = await getEngagementPreferences(accountId)
    lastEngagedByAccount.set(accountId, prefs.last_engaged_at || null)
  }

  for (const send of sends) {
    try {
      const { ready, engaged } = evaluateSendEngagement({
        sentAt: send.sent_at,
        lastEngagedAt: lastEngagedByAccount.get(send.account_id),
        now,
      })
      if (!ready) continue // defensive — shouldn't happen given the query's own cutoff filter

      if (!engaged) {
        await recordNonEngagedSend(send.account_id)
        // Story P2-1 — checked right after the streak counter is incremented, so it sees
        // the freshly-updated consecutive_non_engaged_sends value.
        await maybeFireOffRamp(send.account_id)
      }
      await markEvaluated(send.id)
    } catch (err) {
      console.error(`[cadenceDecay] sweep: failed to evaluate send ${send.id}:`, err.message)
    }
  }
}
