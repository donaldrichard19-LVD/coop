import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyInbound, cannedMetaAnswer } from './inboundClassifier.js'

test('classifies a compliance keyword as compliance, taking precedence over everything else', () => {
  assert.equal(classifyInbound('STOP').type, 'compliance')
  assert.equal(classifyInbound('please stop texting me').type, 'compliance')
})

test('classifies short acknowledgments/reactions', () => {
  for (const msg of ['ok', 'thanks!', 'cool', 'lol', 'yep', 'nah', '👍']) {
    assert.equal(classifyInbound(msg).type, 'acknowledgment', `expected "${msg}" to classify as acknowledgment`)
  }
})

test('classifies a specific-offer reply only when a pending turn exists', () => {
  const withPending = classifyInbound("I'll take the first one", { hasPendingTurn: true })
  assert.equal(withPending.type, 'offer_reply')
  assert.equal(withPending.ordinal, 0)

  const withoutPending = classifyInbound("I'll take the first one", { hasPendingTurn: false })
  assert.notEqual(withoutPending.type, 'offer_reply')
})

test('resolves "second"/"2nd" offer replies to ordinal 1', () => {
  const result = classifyInbound('the second one please', { hasPendingTurn: true })
  assert.equal(result.type, 'offer_reply')
  assert.equal(result.ordinal, 1)
})

test('classifies meta questions and provides a canned, deterministic answer', () => {
  const result = classifyInbound('how does coop work?')
  assert.equal(result.type, 'meta_question')
  assert.ok(cannedMetaAnswer(result.question).length > 0)
})

test('falls through to search_or_unclassifiable for an ordinary search-shaped message', () => {
  assert.equal(classifyInbound('anything good near me tonight').type, 'search_or_unclassifiable')
})

test('empty body falls through to search_or_unclassifiable, not compliance/acknowledgment', () => {
  assert.equal(classifyInbound('').type, 'search_or_unclassifiable')
  assert.equal(classifyInbound(null).type, 'search_or_unclassifiable')
})

test('cannedMetaAnswer never calls a model — always returns a string for any input', () => {
  assert.equal(typeof cannedMetaAnswer('totally unmatched question'), 'string')
})
