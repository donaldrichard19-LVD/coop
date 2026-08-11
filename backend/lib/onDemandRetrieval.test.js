import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyIntentFilters, describeConstraints } from './onDemandRetrieval.js'

function deal(overrides) {
  return {
    id: 'd1',
    merchant: { name: 'Blue Bottle Coffee' },
    category: 'coffee',
    originalPrice: 12,
    ...overrides,
  }
}

test('applyIntentFilters narrows by category', () => {
  const deals = [deal({ id: 'a', category: 'coffee' }), deal({ id: 'b', category: 'pizza' })]
  const result = applyIntentFilters(deals, { category: 'pizza' })
  assert.deepEqual(result.map((d) => d.id), ['b'])
})

test('applyIntentFilters narrows by merchant substring, case-insensitive', () => {
  const deals = [deal({ id: 'a', merchant: { name: 'Blue Bottle Coffee' } }), deal({ id: 'b', merchant: { name: "Tony's Pizza" } })]
  const result = applyIntentFilters(deals, { merchant: 'blue bottle' })
  assert.deepEqual(result.map((d) => d.id), ['a'])
})

test('applyIntentFilters narrows by maxPrice/minPrice', () => {
  const deals = [deal({ id: 'cheap', originalPrice: 8 }), deal({ id: 'pricey', originalPrice: 40 })]
  assert.deepEqual(applyIntentFilters(deals, { maxPrice: 20 }).map((d) => d.id), ['cheap'])
  assert.deepEqual(applyIntentFilters(deals, { minPrice: 20 }).map((d) => d.id), ['pricey'])
})

test('applyIntentFilters does not exclude deals with no originalPrice when a maxPrice filter is set', () => {
  const deals = [deal({ id: 'no-price', originalPrice: null })]
  const result = applyIntentFilters(deals, { maxPrice: 10 })
  assert.deepEqual(result.map((d) => d.id), ['no-price'])
})

test('applyIntentFilters passes everything through when no filters are set', () => {
  const deals = [deal({ id: 'a' }), deal({ id: 'b' })]
  assert.equal(applyIntentFilters(deals, {}).length, 2)
})

test('describeConstraints builds a readable, ordered constraint list', () => {
  const text = describeConstraints({ category: 'thai', maxPrice: 20, maxDistanceMiles: 2 })
  assert.equal(text, 'thai, under $20, within 2 mi')
})

test('describeConstraints returns empty string when no filters are set', () => {
  assert.equal(describeConstraints({}), '')
})
