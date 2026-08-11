import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickNextBestUnrepeated } from './engagementRepetition.js'

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
