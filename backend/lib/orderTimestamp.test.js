import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractOrderTimestamp, normalizeTimestamp } from './orderTimestamp.js'

test('extracts MM/DD/YYYY h:mm AM/PM', () => {
  const result = extractOrderTimestamp('Order Confirmed\n08/11/2026 3:45 PM\nLatte $4.50')
  assert.equal(result, new Date(Date.UTC(2026, 7, 11, 15, 45)).toISOString())
})

test('extracts M/D/YY h:mm in 24h form (no am/pm)', () => {
  const result = extractOrderTimestamp('8/11/26 15:45\nCold Brew $4.00')
  assert.equal(result, new Date(Date.UTC(2026, 7, 11, 15, 45)).toISOString())
})

test('extracts "Mon DD, YYYY h:mm AM/PM"', () => {
  const result = extractOrderTimestamp('Aug 11, 2026 3:45 PM\nBurrito Bowl $9.50')
  assert.equal(result, new Date(Date.UTC(2026, 7, 11, 15, 45)).toISOString())
})

test('extracts "Mon DD, YYYY" with no time, defaulting to midnight', () => {
  const result = extractOrderTimestamp('Receipt\nAug 11, 2026\nChicken Sandwich $6.50')
  assert.equal(result, new Date(Date.UTC(2026, 7, 11, 0, 0)).toISOString())
})

test('extracts bare MM/DD/YYYY with no time, defaulting to midnight', () => {
  const result = extractOrderTimestamp('Receipt\n08/11/2026\nFries $2.75')
  assert.equal(result, new Date(Date.UTC(2026, 7, 11, 0, 0)).toISOString())
})

test('prefers a date+time match over falling through to a looser date-only pattern', () => {
  const result = extractOrderTimestamp('08/11/2026 3:45 PM')
  assert.equal(result, new Date(Date.UTC(2026, 7, 11, 15, 45)).toISOString())
})

test('rejects a calendar-invalid date (Feb 30) rather than silently rolling it over', () => {
  assert.equal(extractOrderTimestamp('Feb 30, 2026'), null)
})

test('returns null when no order timestamp is present at all', () => {
  // Realistic shape of this build's actual eval fixtures — receipts with no printed date.
  const ocrText = 'Blue Bottle Coffee\nReceipt\nLatte $4.50\nCold Brew $4.00\nTotal $8.50'
  assert.equal(extractOrderTimestamp(ocrText), null)
})

test('returns null for empty/missing input', () => {
  assert.equal(extractOrderTimestamp(''), null)
  assert.equal(extractOrderTimestamp(null), null)
})

test('normalizeTimestamp passes through a valid ISO-parseable value', () => {
  assert.equal(normalizeTimestamp('2026-08-11T15:45:00'), new Date('2026-08-11T15:45:00').toISOString())
})

test('normalizeTimestamp rejects an unparseable value', () => {
  assert.equal(normalizeTimestamp('not a date'), null)
  assert.equal(normalizeTimestamp(null), null)
  assert.equal(normalizeTimestamp(undefined), null)
})
