import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickNextBestUnrepeated, repetitionWindowDaysFor } from './engagementRepetition.js'

function scoredCandidate(dealId, score) {
  return { deal: { id: dealId }, score, breakdown: {} }
}

test('picks the top-scored candidate when nothing is excluded', () => {
  const scored = [scoredCandidate('a', 10), scoredCandidate('b', 5)]
  const picked = pickNextBestUnrepeated(scored, new Set())
  assert.equal(picked.deal.id, 'a')
})

test('falls through to the next-best candidate when the top pick was recently sent', () => {
  const scored = [scoredCandidate('a', 10), scoredCandidate('b', 5), scoredCandidate('c', 1)]
  const picked = pickNextBestUnrepeated(scored, new Set(['a']))
  assert.equal(picked.deal.id, 'b')
})

test('returns null (inventory floor) when every candidate has been recently sent', () => {
  const scored = [scoredCandidate('a', 10), scoredCandidate('b', 5)]
  const picked = pickNextBestUnrepeated(scored, new Set(['a', 'b']))
  assert.equal(picked, null)
})

test('returns null for an empty candidate pool', () => {
  assert.equal(pickNextBestUnrepeated([], new Set()), null)
})

test('P2-4: repetitionWindowDaysFor leaves the window unchanged at the 2x/week baseline', () => {
  assert.equal(repetitionWindowDaysFor(2), 14)
})

test('P2-4: repetitionWindowDaysFor scales the window down proportionally for 3x/week', () => {
  assert.equal(repetitionWindowDaysFor(3), 9) // 14 * 2/3 = 9.33... -> 9
})

test('P2-4: repetitionWindowDaysFor falls back to the base window for an invalid send count', () => {
  assert.equal(repetitionWindowDaysFor(0), 14)
  assert.equal(repetitionWindowDaysFor(null), 14)
})

test('P2-4: repetitionWindowDaysFor respects a custom base window', () => {
  assert.equal(repetitionWindowDaysFor(3, 21), 14) // 21 * 2/3 = 14
})
