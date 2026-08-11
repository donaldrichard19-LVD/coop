import { test } from 'node:test'
import assert from 'node:assert/strict'
import { OFF_RAMP_THRESHOLD, shouldFireOffRamp } from './offRamp.js'

test('OFF_RAMP_THRESHOLD is exported as a named constant equal to 2', () => {
  assert.equal(OFF_RAMP_THRESHOLD, 2)
})

test('does not fire below the threshold', () => {
  assert.equal(shouldFireOffRamp({ consecutiveNonEngagedSends: 1, offRampSentAt: null }), false)
})

test('fires exactly at the threshold when not already fired for this streak', () => {
  assert.equal(shouldFireOffRamp({ consecutiveNonEngagedSends: 2, offRampSentAt: null }), true)
})

test('keeps firing-eligible above the threshold too, as long as not already fired', () => {
  assert.equal(shouldFireOffRamp({ consecutiveNonEngagedSends: 3, offRampSentAt: null }), true)
})

test('does not fire again once off_ramp_sent_at is already stamped for this streak', () => {
  assert.equal(
    shouldFireOffRamp({ consecutiveNonEngagedSends: 3, offRampSentAt: '2026-08-10T00:00:00Z' }),
    false,
  )
})

test('treats a missing consecutiveNonEngagedSends as zero (does not fire)', () => {
  assert.equal(shouldFireOffRamp({ consecutiveNonEngagedSends: undefined, offRampSentAt: null }), false)
})
