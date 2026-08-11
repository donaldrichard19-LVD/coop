import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isScheduledSendDay, slotKeyForDate } from './engagementScheduler.js'

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
