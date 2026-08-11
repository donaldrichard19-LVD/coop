import { test } from 'node:test'
import assert from 'node:assert/strict'
import { selectTemplate, renderEngagementTurn } from './engagementRender.js'
import { ENGAGEMENT_TEMPLATES, ALL_ENGAGEMENT_TEMPLATES } from './engagementTemplates.js'

const deal = {
  id: 'd-panera',
  merchant: { name: 'Panera Bread', distance: '0.8 mi' },
  offer: 'Free pastry with any Sip Club drink',
  category: 'fast casual',
  endsLabel: 'Ends Aug 31',
}

test('template library has 40-60 templates spanning all three archetypes', () => {
  assert.ok(ALL_ENGAGEMENT_TEMPLATES.length >= 40 && ALL_ENGAGEMENT_TEMPLATES.length <= 60)
  for (const archetype of ['value', 'discovery', 'weekend']) {
    assert.ok(ENGAGEMENT_TEMPLATES[archetype].length > 0)
  }
})

test('every template id is unique', () => {
  const ids = ALL_ENGAGEMENT_TEMPLATES.map((t) => t.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('selectTemplate is deterministic for the same seed', () => {
  const a = selectTemplate({ archetype: 'value', seed: 'acct-1:2026-08-10' })
  const b = selectTemplate({ archetype: 'value', seed: 'acct-1:2026-08-10' })
  assert.equal(a.id, b.id)
})

test('selectTemplate excludes the last-used template when the pool has alternatives', () => {
  // Try every seed in a small range and confirm none of them pick the excluded template.
  const last = ENGAGEMENT_TEMPLATES.value[0].id
  for (let i = 0; i < 30; i++) {
    const picked = selectTemplate({ archetype: 'value', seed: `seed-${i}`, lastTemplateId: last })
    assert.notEqual(picked.id, last)
  }
})

test('renderEngagementTurn fills all typed slots and returns an AssistantTurn shape', () => {
  const { turn, templateId } = renderEngagementTurn({ archetype: 'value', deal, seed: 'acct-1:2026-08-10' })
  assert.ok(templateId)
  assert.equal(turn.deals.length, 1)
  assert.equal(turn.deals[0], deal)
  assert.deepEqual(turn.quickReplies, [])
  assert.ok(!turn.text.includes('{'), `unfilled slot left in: ${turn.text}`)
  assert.match(turn.text, /Free pastry with any Sip Club drink/)
})

test('every template only uses known typed slots', () => {
  const KNOWN = new Set(['{merchant}', '{offer}', '{category}', '{expiry}'])
  for (const template of ALL_ENGAGEMENT_TEMPLATES) {
    const placeholders = template.text.match(/\{[a-z]+\}/g) || []
    for (const p of placeholders) {
      assert.ok(KNOWN.has(p), `${template.id} uses unknown placeholder ${p}`)
    }
  }
})

test('no template uses {distance} — merchants.distance_label is a single value shared across every account, unsafe to assert as fact in an unprompted proactive text', () => {
  for (const template of ALL_ENGAGEMENT_TEMPLATES) {
    assert.ok(!template.text.includes('{distance}'), `${template.id} still references {distance}`)
  }
})

test('falls back to a generic filler when a deal is missing an optional field', () => {
  const sparseDeal = { id: 'd-sparse', merchant: { name: 'Somewhere' }, offer: '10% off' }
  const { turn } = renderEngagementTurn({ archetype: 'discovery', deal: sparseDeal, seed: 'x' })
  assert.ok(!turn.text.includes('{'), `unfilled slot left in: ${turn.text}`)
})

test('unknown archetype falls back to the value pool', () => {
  const picked = selectTemplate({ archetype: 'not-a-real-archetype', seed: 'x' })
  assert.ok(ENGAGEMENT_TEMPLATES.value.some((t) => t.id === picked.id))
})
