import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isSendWindowEngaged, evaluateThirdSendEligibility } from './thirdSendEligibility.js'

test('isSendWindowEngaged: false when there is no engagement at all', () => {
  const result = isSendWindowEngaged({
    sentAt: '2026-08-01T10:00:00Z',
    nextSentAt: '2026-08-04T10:00:00Z',
    lastEngagedAt: null,
  })
  assert.equal(result, false)
})

test('isSendWindowEngaged: true when the engagement falls inside [sentAt, nextSentAt)', () => {
  const result = isSendWindowEngaged({
    sentAt: '2026-08-01T10:00:00Z',
    nextSentAt: '2026-08-04T10:00:00Z',
    lastEngagedAt: '2026-08-02T12:00:00Z',
  })
  assert.equal(result, true)
})

test('isSendWindowEngaged: false when the engagement falls before sentAt', () => {
  const result = isSendWindowEngaged({
    sentAt: '2026-08-01T10:00:00Z',
    nextSentAt: '2026-08-04T10:00:00Z',
    lastEngagedAt: '2026-07-30T10:00:00Z',
  })
  assert.equal(result, false)
})

test('isSendWindowEngaged: false when the engagement falls at/after nextSentAt (belongs to a later window)', () => {
  const result = isSendWindowEngaged({
    sentAt: '2026-08-01T10:00:00Z',
    nextSentAt: '2026-08-04T10:00:00Z',
    lastEngagedAt: '2026-08-04T10:00:00Z',
  })
  assert.equal(result, false)
})

test('isSendWindowEngaged: the most recent send (nextSentAt null) is bounded by `now` instead', () => {
  const now = new Date('2026-08-06T00:00:00Z')
  const result = isSendWindowEngaged({
    sentAt: '2026-08-04T10:00:00Z',
    nextSentAt: null,
    lastEngagedAt: '2026-08-05T00:00:00Z',
    now,
  })
  assert.equal(result, true)
})

test('evaluateThirdSendEligibility: earned when any one of the last 3 sends was engaged', () => {
  const sends = [
    { sent_at: '2026-07-27T10:00:00Z' },
    { sent_at: '2026-07-30T10:00:00Z' },
    { sent_at: '2026-08-03T10:00:00Z' },
  ]
  // Engagement falls inside the middle send's window (07-30 to 08-03).
  const result = evaluateThirdSendEligibility({ sends, lastEngagedAt: '2026-07-31T00:00:00Z' })
  assert.equal(result, true)
})

test('evaluateThirdSendEligibility: not earned when no send window contains the engagement', () => {
  const sends = [
    { sent_at: '2026-07-27T10:00:00Z' },
    { sent_at: '2026-07-30T10:00:00Z' },
    { sent_at: '2026-08-03T10:00:00Z' },
  ]
  const now = new Date('2026-08-05T00:00:00Z')
  const result = evaluateThirdSendEligibility({ sends, lastEngagedAt: null, now })
  assert.equal(result, false)
})

test('evaluateThirdSendEligibility: works with fewer than 3 sends (new account)', () => {
  const sends = [{ sent_at: '2026-08-03T10:00:00Z' }]
  const now = new Date('2026-08-05T00:00:00Z')
  const result = evaluateThirdSendEligibility({ sends, lastEngagedAt: '2026-08-04T00:00:00Z', now })
  assert.equal(result, true)
})

test('evaluateThirdSendEligibility: empty sends is never earned', () => {
  assert.equal(evaluateThirdSendEligibility({ sends: [], lastEngagedAt: '2026-08-04T00:00:00Z' }), false)
})
