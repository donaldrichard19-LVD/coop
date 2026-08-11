import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isScheduledSendDay, slotKeyForDate, effectiveSendCount, defaultSendDaysFor, SEND_DAYS, SEND_DAYS_3X } from './engagementScheduler.js'

test('Monday and Thursday are scheduled send days', () => {
  assert.equal(isScheduledSendDay(1), true)
  assert.equal(isScheduledSendDay(4), true)
})

test('every other day of the week is not a scheduled send day', () => {
  for (const day of [0, 2, 3, 5, 6]) {
    assert.equal(isScheduledSendDay(day), false)
  }
})

test('slotKeyForDate produces a stable per-calendar-day key', () => {
  const key = slotKeyForDate(new Date('2026-08-11T23:59:00Z'))
  assert.equal(key, '2026-08-11')
})

test('slotKeyForDate differs across calendar days', () => {
  const a = slotKeyForDate(new Date('2026-08-11T00:00:00Z'))
  const b = slotKeyForDate(new Date('2026-08-12T00:00:00Z'))
  assert.notEqual(a, b)
})

test('P2-3: effectiveSendCount is 2 for a standard, un-earned account', () => {
  assert.equal(effectiveSendCount({ cadence_tier: 'standard', earned_third_send: false, is_control_group: false }), 2)
})

test('P2-3: effectiveSendCount is 3 for a standard, earned account', () => {
  assert.equal(effectiveSendCount({ cadence_tier: 'standard', earned_third_send: true, is_control_group: false }), 3)
})

test('P2-3: decay takes precedence — earned but reduced/minimal cadence still caps at 2', () => {
  assert.equal(effectiveSendCount({ cadence_tier: 'reduced', earned_third_send: true, is_control_group: false }), 2)
  assert.equal(effectiveSendCount({ cadence_tier: 'minimal', earned_third_send: true, is_control_group: false }), 2)
})

test('P2-5: control-group accounts never get a 3rd send, even if earned and standard', () => {
  assert.equal(effectiveSendCount({ cadence_tier: 'standard', earned_third_send: true, is_control_group: true }), 2)
})

test('P2-3: defaultSendDaysFor returns the fixed 2x default for a count of 2', () => {
  assert.deepEqual(defaultSendDaysFor(2), SEND_DAYS)
})

test('P2-3: defaultSendDaysFor returns the fixed 3x default (Mon/Wed/Fri) for a count of 3', () => {
  assert.deepEqual(defaultSendDaysFor(3), SEND_DAYS_3X)
  assert.deepEqual(SEND_DAYS_3X, [1, 3, 5])
})
