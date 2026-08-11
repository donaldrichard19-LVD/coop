import { test } from 'node:test'
import assert from 'node:assert/strict'
import { archetypeForDay, archetypeProfile, ARCHETYPES } from './engagementSlotPolicy.js'

test('Monday/Tuesday (early week) -> value archetype', () => {
  assert.equal(archetypeForDay(1), ARCHETYPES.VALUE)
  assert.equal(archetypeForDay(2), ARCHETYPES.VALUE)
})

test('Wednesday/Thursday (midweek) -> discovery archetype', () => {
  assert.equal(archetypeForDay(3), ARCHETYPES.DISCOVERY)
  assert.equal(archetypeForDay(4), ARCHETYPES.DISCOVERY)
})

test('Friday/Saturday/Sunday (late week) -> weekend archetype', () => {
  assert.equal(archetypeForDay(5), ARCHETYPES.WEEKEND)
  assert.equal(archetypeForDay(6), ARCHETYPES.WEEKEND)
  assert.equal(archetypeForDay(0), ARCHETYPES.WEEKEND)
})

test('is deterministic — same day always returns the same archetype', () => {
  for (let i = 0; i < 5; i++) {
    assert.equal(archetypeForDay(4), ARCHETYPES.DISCOVERY)
  }
})

test('archetypeProfile returns a bias profile for every defined archetype', () => {
  for (const archetype of Object.values(ARCHETYPES)) {
    const profile = archetypeProfile(archetype)
    assert.ok(profile.noveltyDirection)
    assert.ok(profile.priceBias)
  }
})

test('archetypeProfile falls back to the value profile for an unknown archetype', () => {
  assert.deepEqual(archetypeProfile('nonsense'), archetypeProfile(ARCHETYPES.VALUE))
})
