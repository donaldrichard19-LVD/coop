import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractLineItems } from './lineItemExtractor.js'

function line(text, priceWordText) {
  const words = text.split(/\s+/).map((w, i) => ({ text: w, bbox: { x0: i * 10, y0: 0, x1: i * 10 + 8, y1: 10 } }))
  if (priceWordText) {
    // Ensure the price word has the rightmost bbox on the line, as a real receipt would.
    words.push({ text: priceWordText, bbox: { x0: 9999, y0: 0, x1: 10050, y1: 10 } })
  }
  return { text, bbox: { x0: 0, y0: 0, x1: 200, y1: 10 }, words }
}

test('returns null for no lines', () => {
  assert.equal(extractLineItems([]), null)
  assert.equal(extractLineItems(null), null)
})

test('extracts a plausible item set from simple item + trailing-price lines', () => {
  const lines = [
    line('Latte $4.50', '$4.50'),
    line('Croissant $3.25', '$3.25'),
    line('Total $7.75', undefined),
  ]
  const result = extractLineItems(lines)
  assert.ok(result, 'expected a non-null result')
  assert.deepEqual(result.items, ['Latte', 'Croissant'])
})

test('excludes stoplist lines (subtotal/tax/total/tip) from the item set', () => {
  const lines = [
    line('Burrito Bowl $9.00', '$9.00'),
    line('Subtotal $9.00', undefined),
    line('Tax $0.81', undefined),
    line('Tip $2.00', undefined),
    line('Total $11.81', undefined),
  ]
  const result = extractLineItems(lines)
  assert.deepEqual(result.items, ['Burrito Bowl'])
})

test('strips a leading quantity multiplier from the item name', () => {
  const lines = [line('2x Latte $9.00', '$9.00')]
  const result = extractLineItems(lines)
  assert.deepEqual(result.items, ['Latte'])
})

test('falls through to null (model path) when the item sum grossly exceeds the total line', () => {
  const lines = [
    line('Latte $40.00', '$40.00'),
    line('Croissant $35.00', '$35.00'),
    line('Total $7.75', undefined),
  ]
  const result = extractLineItems(lines)
  assert.equal(result, null)
})

test('falls through to null when nothing price-shaped is found on any line', () => {
  const lines = [line('Blue Bottle Coffee'), line('San Francisco, CA')]
  assert.equal(extractLineItems(lines), null)
})

test('falls through to null when more than the plausible max number of items are found', () => {
  const lines = Array.from({ length: 30 }, (_, i) => line(`Item ${i} $1.00`, '$1.00'))
  assert.equal(extractLineItems(lines), null)
})

test('ignores a line whose "item name" has no alphabetic characters', () => {
  const lines = [line('#1234 $5.00', '$5.00'), line('Latte $4.50', '$4.50')]
  const result = extractLineItems(lines)
  assert.deepEqual(result.items, ['Latte'])
})

test('tolerates a missing total line — no consistency check applied', () => {
  const lines = [line('Latte $4.50', '$4.50')]
  const result = extractLineItems(lines)
  assert.deepEqual(result.items, ['Latte'])
})
