import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifySoftOptOut, mightBeNegativeFeedback } from './softOptOut.js'

test('classifies "too many" as reduce_cadence', () => {
  assert.equal(classifySoftOptOut('too many texts lately').action, 'reduce_cadence')
  assert.equal(classifySoftOptOut('slow down please').action, 'reduce_cadence')
})

test('classifies wrong-food complaints as exclude_category', () => {
  assert.equal(classifySoftOptOut("wrong food, I don't eat that").action, 'exclude_category')
})

test('classifies wrong-merchant complaints as exclude_merchant', () => {
  assert.equal(classifySoftOptOut('wrong spot, never go there').action, 'exclude_merchant')
})

test('classifies distance complaints as reduce_radius', () => {
  assert.equal(classifySoftOptOut('too far from me').action, 'reduce_radius')
})

test('classifies "not now" as snooze', () => {
  assert.equal(classifySoftOptOut('not right now, maybe later').action, 'snooze')
})

test('returns null when nothing in the ladder matches', () => {
  assert.equal(classifySoftOptOut('what deals do you have near me'), null)
  assert.equal(classifySoftOptOut(''), null)
})

test('mightBeNegativeFeedback is a cheap pre-gate that avoids false-triggering on ordinary search queries', () => {
  assert.equal(mightBeNegativeFeedback("what's good near me tonight"), false)
  assert.equal(mightBeNegativeFeedback('coffee deals please'), false)
  assert.equal(mightBeNegativeFeedback("don't really want this anymore"), true)
  assert.equal(mightBeNegativeFeedback('ugh not this again'), true)
})
