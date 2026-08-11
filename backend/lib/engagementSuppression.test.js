import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateSuppression, isWithinQuietHours, countEligibleDeals, defaultEngagementPreferences } from './engagementSuppression.js'

const readyProfile = { uploadCount: 5, isReady: true, topCategories: ['coffee'], merchantNames: new Set() }
const basePrefs = defaultEngagementPreferences('acct-1')

function baseArgs(overrides = {}) {
  return {
    hardOptedOut: false,
    timezone: 'America/New_York',
    now: new Date('2026-08-11T15:00:00Z'), // 11am ET — outside quiet hours
    preferences: basePrefs,
    sentThisWeekCount: 0,
    eligibleDealCount: 2,
    profile: readyProfile,
    ...overrides,
  }
}

test('hard opt-out suppresses absolutely, before anything else', () => {
  const result = evaluateSuppression(baseArgs({ hardOptedOut: true }))
  assert.deepEqual(result, { suppressed: true, reason: 'hard_opt_out' })
})

test('missing/unresolvable timezone fails safe toward suppression', () => {
  assert.equal(isWithinQuietHours(null), true)
  assert.equal(isWithinQuietHours('Not/AZone'), true)
})

test('quiet hours suppresses even when not hard-opted-out', () => {
  // 11pm ET
  const lateNight = new Date('2026-08-12T03:00:00Z')
  const result = evaluateSuppression(baseArgs({ now: lateNight }))
  assert.deepEqual(result, { suppressed: true, reason: 'quiet_hours' })
})

test('a future snooze suppresses', () => {
  const prefs = { ...basePrefs, snoozed_until: '2026-09-01T00:00:00Z' }
  const result = evaluateSuppression(baseArgs({ preferences: prefs }))
  assert.deepEqual(result, { suppressed: true, reason: 'snoozed' })
})

test('an expired snooze does not suppress', () => {
  const prefs = { ...basePrefs, snoozed_until: '2020-01-01T00:00:00Z' }
  const result = evaluateSuppression(baseArgs({ preferences: prefs }))
  assert.equal(result.suppressed, false)
})

test('minimal cadence tier always suppresses (paused, not opted out)', () => {
  const prefs = { ...basePrefs, cadence_tier: 'minimal' }
  const result = evaluateSuppression(baseArgs({ preferences: prefs }))
  assert.deepEqual(result, { suppressed: true, reason: 'cadence_minimal' })
})

test('frequency cap suppresses once the weekly cap is reached', () => {
  const result = evaluateSuppression(baseArgs({ sentThisWeekCount: 2 })) // standard cap = 2/week
  assert.deepEqual(result, { suppressed: true, reason: 'frequency_cap' })
})

test('reduced cadence tier has a lower frequency cap than standard', () => {
  const prefs = { ...basePrefs, cadence_tier: 'reduced' }
  const result = evaluateSuppression(baseArgs({ preferences: prefs, sentThisWeekCount: 1 }))
  assert.deepEqual(result, { suppressed: true, reason: 'frequency_cap' })
})

test('insufficient inventory suppresses', () => {
  const result = evaluateSuppression(baseArgs({ eligibleDealCount: 0 }))
  assert.deepEqual(result, { suppressed: true, reason: 'insufficient_inventory' })
})

test('profile not yet ready (below MIN_UPLOADS_FOR_PROFILE) suppresses', () => {
  const result = evaluateSuppression(baseArgs({ profile: { uploadCount: 1 } }))
  assert.deepEqual(result, { suppressed: true, reason: 'profile_not_ready' })
})

test('clears every gate -> not suppressed', () => {
  const result = evaluateSuppression(baseArgs())
  assert.equal(result.suppressed, false)
  assert.ok(result.preferences)
})

test('countEligibleDeals respects category and merchant exclusions', () => {
  const deals = [
    { status: 'active', category: 'coffee', merchant: { name: 'Blue Bottle Coffee' } },
    { status: 'active', category: 'pizza', merchant: { name: "Tony's Pizza" } },
    { status: 'expired', category: 'coffee', merchant: { name: 'Blue Bottle Coffee' } },
  ]
  const prefs = { ...basePrefs, excluded_categories: ['pizza'] }
  assert.equal(countEligibleDeals(deals, {}, prefs), 1)
})
