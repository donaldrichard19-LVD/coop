import { test } from 'node:test'
import assert from 'node:assert/strict'
import { topNDaysOfWeek, resolveSendDays } from './engagementDayOptimization.js'

test('topNDaysOfWeek picks the highest-weight days, sorted ascending by day number', () => {
  // Sunday=0.5, Wednesday=3, Friday=1
  const weights = [0.5, 0, 0, 3, 0, 1, 0]
  assert.deepEqual(topNDaysOfWeek(weights, 2), [3, 5]) // Wed, Fri — highest two weights
})

test('topNDaysOfWeek returns fewer than n when fewer days have positive weight', () => {
  const weights = [0, 0, 0, 3, 0, 0, 0]
  assert.deepEqual(topNDaysOfWeek(weights, 3), [3])
})

test('topNDaysOfWeek returns empty for an all-zero histogram', () => {
  assert.deepEqual(topNDaysOfWeek([0, 0, 0, 0, 0, 0, 0], 2), [])
})

const defaultDays = [1, 4]

test('control-group accounts always stay on the fixed default, regardless of signal', () => {
  const profile = { orderTimestampCount: 10, dayOfWeekWeight: [0, 3, 0, 2, 0, 0, 0] }
  const preferences = { is_control_group: true }
  assert.deepEqual(resolveSendDays({ profile, preferences, effectiveSendCount: 2, defaultDays }), defaultDays)
})

test('falls back to default when there are not enough dated-order rows yet', () => {
  const profile = { orderTimestampCount: 2, dayOfWeekWeight: [0, 3, 0, 2, 0, 0, 0] }
  const preferences = { is_control_group: false }
  assert.deepEqual(resolveSendDays({ profile, preferences, effectiveSendCount: 2, defaultDays }), defaultDays)
})

test('personalizes when there is enough signal and enough distinct days', () => {
  // Monday=3, Wednesday=2 -> top 2 = [1, 3]
  const profile = { orderTimestampCount: 5, dayOfWeekWeight: [0, 3, 0, 2, 0, 0, 0] }
  const preferences = { is_control_group: false }
  assert.deepEqual(resolveSendDays({ profile, preferences, effectiveSendCount: 2, defaultDays }), [1, 3])
})

test('falls back to default when signal exists but not enough distinct days to fill every slot', () => {
  // Only Monday has any weight at all — can't fill 2 personalized slots.
  const profile = { orderTimestampCount: 5, dayOfWeekWeight: [0, 3, 0, 0, 0, 0, 0] }
  const preferences = { is_control_group: false }
  assert.deepEqual(resolveSendDays({ profile, preferences, effectiveSendCount: 2, defaultDays }), defaultDays)
})

test('missing profile/preferences fail safe to the default', () => {
  assert.deepEqual(resolveSendDays({ profile: null, preferences: null, effectiveSendCount: 2, defaultDays }), defaultDays)
})
