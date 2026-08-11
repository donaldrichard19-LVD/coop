import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoreCandidates, isWithinRadius } from './engagementScoring.js'
import { ARCHETYPES } from './engagementSlotPolicy.js'

function deal(overrides) {
  return {
    id: 'd1',
    merchant: { name: 'Blue Bottle Coffee', distance: '0.3 mi' },
    category: 'coffee',
    offer: 'Free drip coffee',
    savingsAmount: 4.2,
    originalPrice: null,
    status: 'active',
    endsLabel: 'Ends Sunday',
    ...overrides,
  }
}

test('isWithinRadius is a permissive pass-through (guardrail #1)', () => {
  assert.equal(isWithinRadius(deal(), {}, null), true)
  assert.equal(isWithinRadius(deal(), { zip_code: null }, 5), true)
})

test('excludes expired and used deals', () => {
  const deals = [deal({ id: 'a', status: 'expired' }), deal({ id: 'b', status: 'used' }), deal({ id: 'c', status: 'active' })]
  const profile = { topCategories: ['coffee'], merchantNames: new Set() }
  const scored = scoreCandidates({ deals, profile, archetype: ARCHETYPES.VALUE, account: {} })
  assert.equal(scored.length, 1)
  assert.equal(scored[0].deal.id, 'c')
})

test('value archetype ranks a familiar merchant above an unfamiliar one, category equal', () => {
  const familiar = deal({ id: 'familiar', merchant: { name: 'Blue Bottle Coffee' } })
  const unfamiliar = deal({ id: 'unfamiliar', merchant: { name: 'Some New Place' } })
  const profile = { topCategories: ['coffee'], merchantNames: new Set(['Blue Bottle Coffee']) }
  const scored = scoreCandidates({ deals: [unfamiliar, familiar], profile, archetype: ARCHETYPES.VALUE, account: {} })
  assert.equal(scored[0].deal.id, 'familiar')
})

test('discovery archetype ranks an unfamiliar merchant above a familiar one, category equal', () => {
  const familiar = deal({ id: 'familiar', merchant: { name: 'Blue Bottle Coffee' } })
  const unfamiliar = deal({ id: 'unfamiliar', merchant: { name: 'Some New Place' } })
  const profile = { topCategories: ['coffee'], merchantNames: new Set(['Blue Bottle Coffee']) }
  const scored = scoreCandidates({ deals: [familiar, unfamiliar], profile, archetype: ARCHETYPES.DISCOVERY, account: {} })
  assert.equal(scored[0].deal.id, 'unfamiliar')
})

test('category affinity ranks a top-category deal above an off-profile category', () => {
  const onProfile = deal({ id: 'on', category: 'coffee' })
  const offProfile = deal({ id: 'off', category: 'mexican' })
  const profile = { topCategories: ['coffee', 'pizza'], merchantNames: new Set() }
  const scored = scoreCandidates({ deals: [offProfile, onProfile], profile, archetype: ARCHETYPES.VALUE, account: {} })
  assert.equal(scored[0].deal.id, 'on')
})

test('every candidate carries a loggable/explainable score breakdown', () => {
  const profile = { topCategories: ['coffee'], merchantNames: new Set() }
  const scored = scoreCandidates({ deals: [deal()], profile, archetype: ARCHETYPES.VALUE, account: {} })
  assert.equal(scored.length, 1)
  assert.ok(typeof scored[0].score === 'number')
  assert.ok(scored[0].breakdown.categoryAffinity !== undefined)
  assert.ok(scored[0].breakdown.priceTierFit !== undefined)
  assert.ok(scored[0].breakdown.merchantFamiliarity !== undefined)
  assert.ok(scored[0].breakdown.dealStrength !== undefined)
})

test('is deterministic and reproducible — same inputs, same output', () => {
  const deals = [deal({ id: 'a' }), deal({ id: 'b', category: 'pizza' })]
  const profile = { topCategories: ['coffee'], merchantNames: new Set() }
  const first = scoreCandidates({ deals, profile, archetype: ARCHETYPES.WEEKEND, account: {} })
  const second = scoreCandidates({ deals, profile, archetype: ARCHETYPES.WEEKEND, account: {} })
  assert.deepEqual(
    first.map((s) => [s.deal.id, s.score]),
    second.map((s) => [s.deal.id, s.score]),
  )
})
