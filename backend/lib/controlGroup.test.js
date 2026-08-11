import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isControlGroupAccount } from './controlGroup.js'

test('is deterministic — same account id always produces the same result', () => {
  const id = 'a1b2c3d4-0000-0000-0000-000000000001'
  const first = isControlGroupAccount(id)
  const second = isControlGroupAccount(id)
  assert.equal(first, second)
})

test('different account ids can produce different results (not a constant)', () => {
  const results = new Set()
  for (let i = 0; i < 200; i++) {
    results.add(isControlGroupAccount(`00000000-0000-0000-0000-${String(i).padStart(12, '0')}`))
  }
  assert.ok(results.has(true) && results.has(false), 'expected both true and false across 200 distinct ids')
})

test('roughly a 10% split over a large sample of distinct ids', () => {
  const sampleSize = 5000
  let controlCount = 0
  for (let i = 0; i < sampleSize; i++) {
    if (isControlGroupAccount(`11111111-2222-3333-4444-${String(i).padStart(12, '0')}`)) controlCount++
  }
  const rate = controlCount / sampleSize
  // Generous tolerance band — this is checking the hash isn't wildly skewed, not pinning an
  // exact statistical bound.
  assert.ok(rate > 0.07 && rate < 0.13, `expected ~10% control-group rate, got ${(rate * 100).toFixed(1)}%`)
})
