import { supabase } from './supabase.js'
import { isHardOptedOut } from './optOut.js'
import { isWithinRadius } from './engagementScoring.js'
import { MIN_UPLOADS_FOR_PROFILE } from './preferenceProfile.js'

// Story A2 — the gate every scheduled-engagement attempt must clear before anything is
// rendered or sent. Split into a pure decision core (evaluateSuppression, isWithinQuietHours
// — fully unit-testable without credentials) and a thin async I/O wrapper (checkSuppression)
// that fetches the inputs those pure functions need, matching this codebase's rcs/render.js
// (pure) vs lib/twilioClient.js (I/O) split.

const QUIET_HOURS_START_HOUR = 21 // 9pm local — no sends at/after this hour
const QUIET_HOURS_END_HOUR = 9 // 9am local — no sends before this hour

const MIN_ELIGIBLE_INVENTORY = 1

// Frequency cap per cadence tier (Story A2/A10/A11). 'minimal' is effectively paused —
// distinct from a hard opt-out (A8): the account can still resume via a future cadence
// change, no STOP/START round trip needed.
export const CADENCE_FREQUENCY_CAP = {
  standard: { sendsPerWeek: 2 },
  reduced: { sendsPerWeek: 1 },
  minimal: { sendsPerWeek: 0 },
}

export function defaultEngagementPreferences(accountId) {
  return {
    account_id: accountId,
    cadence_tier: 'standard',
    send_window: null,
    snoozed_until: null,
    excluded_categories: [],
    excluded_merchants: [],
    radius_override: null,
    consecutive_non_engaged_sends: 0,
    last_engaged_at: null,
  }
}

/**
 * Pure. Returns true when `now` (in the given IANA timezone) falls inside the quiet-hours
 * window [21:00, 09:00). Fails SAFE toward suppression, not toward sending: a missing or
 * unresolvable timezone returns true (i.e. "treat as quiet hours, don't send") — per the
 * accounts.timezone column comment, sending an unwanted message at an unknown local hour is
 * the worse failure mode than a delayed send.
 */
export function isWithinQuietHours(timezone, now = new Date()) {
  if (!timezone) return true
  let hour
  try {
    hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone }).format(now))
  } catch (err) {
    console.error(`[engagementSuppression] invalid timezone "${timezone}" — failing safe:`, err.message)
    return true
  }
  if (hour === 24) hour = 0 // some ICU formatters emit 24 for midnight
  return hour >= QUIET_HOURS_START_HOUR || hour < QUIET_HOURS_END_HOUR
}

export function countEligibleDeals(deals, account, preferences) {
  return deals.filter((deal) => {
    if (deal.status === 'expired' || deal.status === 'used') return false
    if (preferences.excluded_categories?.includes(deal.category)) return false
    if (preferences.excluded_merchants?.includes(deal.merchant?.name)) return false
    if (!isWithinRadius(deal, account, preferences.radius_override)) return false
    return true
  }).length
}

/**
 * Pure decision core — every input is a plain value the caller already fetched, no I/O
 * here. Checks run in the exact order the build plan specifies: hard opt-out (absolute),
 * quiet hours, soft opt-out state (snooze/cadence/exclusions), frequency cap, minimum
 * eligible inventory, then profile-readiness. Returns { suppressed, reason } or
 * { suppressed: false, preferences }.
 */
export function evaluateSuppression({
  hardOptedOut,
  timezone,
  now = new Date(),
  preferences,
  sentThisWeekCount,
  eligibleDealCount,
  profile,
}) {
  if (hardOptedOut) return { suppressed: true, reason: 'hard_opt_out' }

  if (isWithinQuietHours(timezone, now)) return { suppressed: true, reason: 'quiet_hours' }

  if (preferences.snoozed_until && new Date(preferences.snoozed_until) > now) {
    return { suppressed: true, reason: 'snoozed' }
  }

  const cap = CADENCE_FREQUENCY_CAP[preferences.cadence_tier] || CADENCE_FREQUENCY_CAP.standard
  if (cap.sendsPerWeek === 0) return { suppressed: true, reason: 'cadence_minimal' }
  if (sentThisWeekCount >= cap.sendsPerWeek) return { suppressed: true, reason: 'frequency_cap' }

  if (eligibleDealCount < MIN_ELIGIBLE_INVENTORY) return { suppressed: true, reason: 'insufficient_inventory' }

  if (!profile || profile.uploadCount < MIN_UPLOADS_FOR_PROFILE) {
    return { suppressed: true, reason: 'profile_not_ready' }
  }

  return { suppressed: false, preferences }
}

export async function getEngagementPreferences(accountId) {
  const { data, error } = await supabase.from('engagement_preferences').select('*').eq('account_id', accountId).maybeSingle()
  if (error) {
    console.error('[engagementSuppression] preferences lookup failed — using defaults:', error.message)
  }
  return data || defaultEngagementPreferences(accountId)
}

async function sentCountLast7Days(accountId) {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const { data, error } = await supabase
    .from('engagement_sends')
    .select('id')
    .eq('account_id', accountId)
    .eq('status', 'sent')
    .gte('sent_at', since)
  if (error) {
    console.error('[engagementSuppression] send-count lookup failed — failing safe (treating as at cap):', error.message)
    return Number.MAX_SAFE_INTEGER
  }
  return data.length
}

/**
 * Async orchestration: fetches every input evaluateSuppression needs, then delegates the
 * actual decision to it. `deals` is the account's candidate deal pool (lib/deals.js#fetchDeals
 * output) — this function only counts eligible ones for the inventory-floor check; it does
 * NOT do A4's archetype-specific ranking (that happens later in the pipeline, only once
 * suppression has cleared).
 */
export async function checkSuppression({ account, profile, deals }) {
  const hardOptedOut = await isHardOptedOut(account.id)
  const preferences = await getEngagementPreferences(account.id)
  const sentThisWeekCount = await sentCountLast7Days(account.id)
  const eligibleDealCount = countEligibleDeals(deals, account, preferences)

  return evaluateSuppression({
    hardOptedOut,
    timezone: account.timezone,
    preferences,
    sentThisWeekCount,
    eligibleDealCount,
    profile,
  })
}
