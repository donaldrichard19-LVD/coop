import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoreCandidates, scoreCandidatesControlGroup, isWithinRadius, RECENT_MERCHANT_PENALTY } from './engagementScoring.js'
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

test('P2-4: a candidate matching the recently-sent merchant is scored down by RECENT_MERCHANT_PENALTY, not excluded', () => {
  const profile = { topCategories: ['coffee'], merchantNames: new Set() }
  const withoutPenalty = scoreCandidates({ deals: [deal()], profile, archetype: ARCHETYPES.VALUE, account: {} })
  const withPenalty = scoreCandidates({
    deals: [deal()],
    profile,
    archetype: ARCHETYPES.VALUE,
    account: {},
    recentMerchantName: 'Blue Bottle Coffee', // matches deal()'s default merchant
  })
  assert.equal(withPenalty.length, 1) // still present — soft penalty, not a hard exclusion
  assert.ok(Math.abs(withoutPenalty[0].score - withPenalty[0].score - RECENT_MERCHANT_PENALTY) < 1e-9)
  assert.equal(withPenalty[0].breakdown.recentMerchantPenaltyApplied, true)
})

test('P2-4: no penalty applied when recentMerchantName does not match the candidate merchant', () => {
  const profile = { topCategories: ['coffee'], merchantNames: new Set() }
  const scored = scoreCandidates({
    deals: [deal()],
    profile,
    archetype: ARCHETYPES.VALUE,
    account: {},
    recentMerchantName: 'Some Other Place',
  })
  assert.equal(scored[0].breakdown.recentMerchantPenaltyApplied, false)
})

test('P2-4: the merchant penalty can flip a close ranking', () => {
  const target = deal({ id: 'target', merchant: { name: 'Blue Bottle Coffee' }, savingsAmount: 4.2 })
  const rival = deal({ id: 'rival', merchant: { name: 'Some New Place' }, savingsAmount: 4.0 })
  const profile = { topCategories: ['coffee'], merchantNames: new Set() }
  const withoutRecent = scoreCandidates({ deals: [target, rival], profile, archetype: ARCHETYPES.VALUE, account: {} })
  assert.equal(withoutRecent[0].deal.id, 'target') // target wins on its own merits

  const withRecent = scoreCandidates({
    deals: [target, rival],
    profile,
    archetype: ARCHETYPES.VALUE,
    account: {},
    recentMerchantName: 'Blue Bottle Coffee',
  })
  assert.equal(withRecent[0].deal.id, 'rival') // penalty flips it
})

test('P2-5: control-group scoring ranks purely by deal strength, ignoring profile/archetype', () => {
  const cheap = deal({ id: 'cheap', category: 'mexican', merchant: { name: 'Off Profile' }, savingsAmount: 1 })
  const strong = deal({ id: 'strong', category: 'mexican', merchant: { name: 'Off Profile' }, savingsAmount: 10 })
  const scored = scoreCandidatesControlGroup({ deals: [cheap, strong], account: {} })
  assert.equal(scored[0].deal.id, 'strong')
  assert.deepEqual(Object.keys(scored[0].breakdown).sort(), ['dealStrength', 'recentMerchantPenaltyApplied'])
})

test('P2-5: control-group scoring also excludes expired/used deals', () => {
  const scored = scoreCandidatesControlGroup({ deals: [deal({ id: 'a', status: 'expired' }), deal({ id: 'b', status: 'active' })], account: {} })
  assert.equal(scored.length, 1)
  assert.equal(scored[0].deal.id, 'b')
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
