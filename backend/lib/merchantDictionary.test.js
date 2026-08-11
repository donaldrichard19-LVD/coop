import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchMerchantAgainstDictionary } from './merchantDictionary.js'

const DICTIONARY = [
  { name: 'Blue Bottle Coffee', category: 'coffee', match_strings: ['blue bottle'] },
  { name: 'Chipotle', category: 'fast casual', match_strings: ['chipotle'] },
  { name: 'Subway', category: 'fast casual', match_strings: ['subway'] },
]

test('matches on a word-bounded substring', () => {
  const result = matchMerchantAgainstDictionary('Thanks for ordering from Blue Bottle Coffee!', DICTIONARY)
  assert.deepEqual(result, { name: 'Blue Bottle Coffee', category: 'coffee' })
})

test('is case-insensitive', () => {
  const result = matchMerchantAgainstDictionary('CHIPOTLE MEXICAN GRILL', DICTIONARY)
  assert.equal(result.name, 'Chipotle')
})

test('does not false-positive on a substring inside an unrelated longer word', () => {
  // "subway" as a substring of "subwayfoodz" should not match with word boundaries.
  const result = matchMerchantAgainstDictionary('order from subwayfoodz today', DICTIONARY)
  assert.equal(result, null)
})

test('returns null when nothing matches', () => {
  assert.equal(matchMerchantAgainstDictionary('some totally unrelated receipt text', DICTIONARY), null)
})

test('returns null for empty/missing OCR text', () => {
  assert.equal(matchMerchantAgainstDictionary('', DICTIONARY), null)
  assert.equal(matchMerchantAgainstDictionary(null, DICTIONARY), null)
})
