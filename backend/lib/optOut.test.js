import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyCompliance } from './optOut.js'

test('classifies STOP as a hard opt-out', () => {
  assert.equal(classifyCompliance('STOP').type, 'stop')
  assert.equal(classifyCompliance('stop').type, 'stop')
})

test('matches STOP-family keywords mid-sentence', () => {
  assert.equal(classifyCompliance('please stop texting me').type, 'stop')
  assert.equal(classifyCompliance('unsubscribe me from this').type, 'stop')
  assert.equal(classifyCompliance('can you cancel these messages').type, 'stop')
  assert.equal(classifyCompliance('end this please').type, 'stop')
  assert.equal(classifyCompliance('quit sending me stuff').type, 'stop')
})

test('STOPALL and "stop all" both classify as stop with a normalized keyword', () => {
  assert.deepEqual(classifyCompliance('STOPALL'), { type: 'stop', keyword: 'stopall' })
  assert.deepEqual(classifyCompliance('stop all messages'), { type: 'stop', keyword: 'stopall' })
})

test('classifies START/UNSTOP as resume', () => {
  assert.equal(classifyCompliance('START').type, 'resume')
  assert.equal(classifyCompliance('unstop').type, 'resume')
  assert.equal(classifyCompliance('please start again').type, 'resume')
})

test('classifies HELP as help', () => {
  assert.equal(classifyCompliance('HELP').type, 'help')
  assert.equal(classifyCompliance('need help with something').type, 'help')
})

test('stop takes precedence over other keywords when both could plausibly match', () => {
  // "cancel" (stop-family) appears; classification should not fall through to help/resume.
  assert.equal(classifyCompliance('help me cancel this').type, 'stop')
})

test('returns null for an ordinary message with no compliance keyword', () => {
  assert.equal(classifyCompliance('any deals near me tonight?'), null)
  assert.equal(classifyCompliance(''), null)
  assert.equal(classifyCompliance(null), null)
})

test('does not false-positive on substrings that merely contain a keyword', () => {
  // "cancellation" contains "cancel" only as a substring, not a word-bounded match.
  assert.equal(classifyCompliance('what is your cancellation policy'), null)
})
