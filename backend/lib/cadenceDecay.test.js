import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CADENCE_DECAY_THRESHOLD, NON_ENGAGEMENT_WINDOW_HOURS, evaluateSendEngagement } from './cadenceDecay.js'

test('CADENCE_DECAY_THRESHOLD is exported as a named constant equal to 4', () => {
  assert.equal(CADENCE_DECAY_THRESHOLD, 4)
})

test('NON_ENGAGEMENT_WINDOW_HOURS is exported as a named constant equal to 48', () => {
  assert.equal(NON_ENGAGEMENT_WINDOW_HOURS, 48)
})

test('not ready when the 48h window has not yet elapsed', () => {
  const sentAt = new Date('2026-08-11T10:00:00Z')
  const now = new Date('2026-08-12T10:00:00Z') // only 24h later
  const result = evaluateSendEngagement({ sentAt, lastEngagedAt: null, now })
  assert.deepEqual(result, { ready: false })
})

test('ready and not engaged when the window has elapsed with no engagement at all', () => {
  const sentAt = new Date('2026-08-11T10:00:00Z')
  const now = new Date('2026-08-13T10:00:01Z') // just past 48h
  const result = evaluateSendEngagement({ sentAt, lastEngagedAt: null, now })
  assert.deepEqual(result, { ready: true, engaged: false })
})

test('ready and engaged when last_engaged_at falls inside the 48h window', () => {
  const sentAt = new Date('2026-08-11T10:00:00Z')
  const lastEngagedAt = new Date('2026-08-12T10:00:00Z') // 24h after sent, inside window
  const now = new Date('2026-08-13T10:00:01Z')
  const result = evaluateSendEngagement({ sentAt, lastEngagedAt, now })
  assert.deepEqual(result, { ready: true, engaged: true })
})

test('ready but not engaged when last_engaged_at is before sent_at (stale prior engagement)', () => {
  const sentAt = new Date('2026-08-11T10:00:00Z')
  const lastEngagedAt = new Date('2026-08-10T10:00:00Z') // before this send even went out
  const now = new Date('2026-08-13T10:00:01Z')
  const result = evaluateSendEngagement({ sentAt, lastEngagedAt, now })
  assert.deepEqual(result, { ready: true, engaged: false })
})

test('ready but not engaged when last_engaged_at is after the 48h window closed', () => {
  const sentAt = new Date('2026-08-11T10:00:00Z')
  const lastEngagedAt = new Date('2026-08-14T10:00:00Z') // well past the 48h window
  const now = new Date('2026-08-15T00:00:00Z')
  const result = evaluateSendEngagement({ sentAt, lastEngagedAt, now })
  assert.deepEqual(result, { ready: true, engaged: false })
})

test('exactly at the 48h boundary counts as engaged (inclusive upper bound)', () => {
  const sentAt = new Date('2026-08-11T10:00:00Z')
  const lastEngagedAt = new Date('2026-08-13T10:00:00Z') // exactly 48h after sent_at
  const now = new Date('2026-08-13T10:00:00Z')
  const result = evaluateSendEngagement({ sentAt, lastEngagedAt, now })
  assert.deepEqual(result, { ready: true, engaged: true })
})

test('engagement exactly at sent_at counts as engaged (inclusive lower bound)', () => {
  const sentAt = new Date('2026-08-11T10:00:00Z')
  const lastEngagedAt = new Date('2026-08-11T10:00:00Z')
  const now = new Date('2026-08-13T10:00:01Z')
  const result = evaluateSendEngagement({ sentAt, lastEngagedAt, now })
  assert.deepEqual(result, { ready: true, engaged: true })
})
