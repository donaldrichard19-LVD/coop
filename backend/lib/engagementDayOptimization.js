// Story P2-2 — per-account send-day selection. Pure decision core, kept separate from
// engagementScheduler.js (which owns turning this into "does today count for this
// account") so it's directly unit-testable without the scheduler's DB/cron scaffolding —
// same pure-decision-core convention as engagementSuppression.js/cadenceDecay.js.

import { MIN_ORDER_TIMESTAMPS_FOR_DAY_SIGNAL } from './preferenceProfile.js'

/**
 * Pure. Given a 7-slot day-of-week weight array (index 0=Sunday..6=Saturday, matching
 * Date#getDay() — see preferenceProfile.js#getPreferenceProfile), returns the top `n`
 * distinct days with positive weight, sorted ascending by day-of-week number (not by
 * weight) so the result is stable/comparable regardless of weight ties. Returns fewer than
 * n entries if fewer than n days have any positive weight at all.
 */
export function topNDaysOfWeek(dayOfWeekWeight, n) {
  return (dayOfWeekWeight || [])
    .map((weight, day) => ({ day, weight }))
    .filter((d) => d.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, n)
    .map((d) => d.day)
    .sort((a, b) => a - b)
}

/**
 * Pure. Decides which days of the week an account should be sent to this scheduler tick.
 * Re-evaluated fresh on every call (no memoization/persistence) — deterministic given the
 * same histogram input, per the plan, so "re-evaluate on each tick" just means "call this
 * again," not any extra bookkeeping.
 *
 * - Control-group accounts (preferences.is_control_group) always stay on defaultDays,
 *   full stop — Story P2-5 excludes them from personalization entirely, checked here once
 *   rather than duplicated at every call site.
 * - Otherwise, personalizes when the profile has "enough" dated-order signal
 *   (MIN_ORDER_TIMESTAMPS_FOR_DAY_SIGNAL) AND the histogram actually has effectiveSendCount
 *   distinct positive-weight days to offer — falling back to defaultDays rather than
 *   personalizing to fewer days than the account is entitled to send on (e.g. an account
 *   with only ever-Monday order history earning a 3rd send should not be silently reduced
 *   to a single personalized day; it should get the fixed 3-day default instead).
 */
export function resolveSendDays({ profile, preferences, effectiveSendCount, defaultDays }) {
  if (preferences?.is_control_group) return defaultDays

  const orderTimestampCount = profile?.orderTimestampCount || 0
  if (orderTimestampCount < MIN_ORDER_TIMESTAMPS_FOR_DAY_SIGNAL) return defaultDays

  const personalized = topNDaysOfWeek(profile?.dayOfWeekWeight, effectiveSendCount)
  if (personalized.length < effectiveSendCount) return defaultDays

  return personalized
}
