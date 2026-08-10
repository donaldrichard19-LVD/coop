import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderTurnAsRCS } from './render.js'
import { matchDeals, quickReplies } from '../../src/data/deals.js'

const FAKE_SIDS = {
  card: 'HXcard',
  carousel: 'HXcarousel',
  chipsOpening: 'HXchipsopen',
  chipsFollowup: 'HXchipsfollow',
}

// Local fixture, deliberately not imported from src/data/deals.js — that
// module is now backed by Supabase (via DealsContext's fetchDeals), so a
// pure unit test of the RCS rendering layer shouldn't depend on it. Mirrors
// the shape the old hardcoded mock array used, since these tests were
// originally written against it and their assertions assume its values.
const deals = [
  {
    id: 'd-bluebottle',
    merchant: { name: 'Blue Bottle Coffee', initials: 'BB', visitCount: 24, firstVisit: 'March', distance: '0.3 mi' },
    offer: 'Free drip coffee with any pastry purchase',
    savingsAmount: 4.2,
    originalPrice: null,
    code: null,
    status: 'expiring',
    endsLabel: 'Ends Sunday',
  },
  {
    id: 'd-chipotle',
    merchant: { name: 'Chipotle', initials: 'CH', visitCount: 18, firstVisit: 'January', distance: '0.6 mi' },
    offer: '$0 delivery fee on orders over $15',
    savingsAmount: 3.99,
    originalPrice: null,
    code: 'CHIP-ZERO-15',
    status: 'endingToday',
    endsLabel: 'Ends tonight at 10pm',
  },
  {
    id: 'd-panera',
    merchant: { name: 'Panera Bread', initials: 'PB', visitCount: 9, firstVisit: 'April', distance: '0.8 mi' },
    offer: 'Free pastry with any Sip Club drink',
    savingsAmount: 3.5,
    originalPrice: null,
    code: null,
    status: 'active',
    endsLabel: 'Ends Aug 31',
  },
  {
    id: 'd-tonys',
    merchant: { name: "Tony's Pizza Napoletana", initials: 'TP', visitCount: 6, firstVisit: 'May', distance: '1.1 mi' },
    offer: '15% off your next visit',
    savingsAmount: 6.75,
    originalPrice: 45.0,
    code: 'TONYS-REGULAR-15',
    status: 'expiring',
    endsLabel: 'Ends Friday',
  },
]

test('zero-deal turn: text message only, no template messages', () => {
  const turn = { text: "Nothing matches that — try a different merchant.", deals: [], quickReplies: [] }
  const messages = renderTurnAsRCS(turn, { templateSids: FAKE_SIDS })
  assert.equal(messages.length, 1)
  assert.equal(messages[0].kind, 'text')
  assert.match(messages[0].body, /Nothing matches/)
})

test('one-deal turn: text + single card template, correct variable slots', () => {
  const deal = deals.find((d) => d.id === 'd-panera')
  const turn = { text: 'Found one for you.', deals: [deal], quickReplies: [] }
  const messages = renderTurnAsRCS(turn, { templateSids: FAKE_SIDS })

  assert.equal(messages.length, 2)
  assert.equal(messages[1].template, 'card')
  assert.equal(messages[1].contentSid, 'HXcard')
  const vars = messages[1].contentVariables
  assert.equal(vars[1], deal.offer)
  assert.match(vars[2], /visits since/)
  assert.match(vars[3], /Save ~\$3\.50/)
  assert.match(vars[4], /google\.com\/maps/)
})

test('two-deal turn: carousel template gets 8 offset variables (4 per card)', () => {
  const matches = matchDeals('expiring', deals)
  const shown = matches.slice(0, 2)
  assert.equal(shown.length, 2, 'fixture assumption: at least 2 expiring deals in mock data')

  const turn = { text: 'A couple are ending soon.', deals: shown, quickReplies: [] }
  const messages = renderTurnAsRCS(turn, { templateSids: FAKE_SIDS })

  const carouselMsg = messages.find((m) => m.template === 'carousel')
  assert.ok(carouselMsg, 'expected a carousel message')
  assert.equal(carouselMsg.contentSid, 'HXcarousel')
  assert.equal(carouselMsg.contentVariables[1], shown[0].offer)
  assert.equal(carouselMsg.contentVariables[5], shown[1].offer)
})

test('promo code, when present, is folded into the plain-text card body (no COPY_CODE — RCS-unsupported)', () => {
  const deal = deals.find((d) => d.code)
  assert.ok(deal, 'fixture assumption: at least one mock deal has a code')
  const turn = { text: 'Here.', deals: [deal], quickReplies: [] }
  const [, cardMsg] = renderTurnAsRCS(turn, { templateSids: FAKE_SIDS })
  assert.match(cardMsg.contentVariables[3], new RegExp(`Code: ${deal.code}`))
})

test('quick replies on the first turn use the opening chip template; later turns use follow-up', () => {
  const turn = { text: 'Hi', deals: [], quickReplies: quickReplies.slice(0, 3) }
  const first = renderTurnAsRCS(turn, { templateSids: FAKE_SIDS, isFirstTurn: true })
  const later = renderTurnAsRCS(turn, { templateSids: FAKE_SIDS, isFirstTurn: false })
  assert.equal(first.at(-1).template, 'chipsOpening')
  assert.equal(later.at(-1).template, 'chipsFollowup')
})

test('more than 2 deals in a turn throws — Coop\'s hard "max 2 cards" rule is enforced here too', () => {
  const turn = { text: 'x', deals: deals.slice(0, 3), quickReplies: [] }
  assert.throws(() => renderTurnAsRCS(turn, { templateSids: FAKE_SIDS }), /at most 2/)
})

test('subtitle is truncated to fit the 60-char RCS limit', () => {
  const longDeal = {
    ...deals[0],
    merchant: { ...deals[0].merchant, name: 'A'.repeat(80), firstVisit: 'a very long month name indeed' },
  }
  const turn = { text: 'x', deals: [longDeal], quickReplies: [] }
  const [, cardMsg] = renderTurnAsRCS(turn, { templateSids: FAKE_SIDS })
  assert.ok(cardMsg.contentVariables[2].length <= 60)
})
