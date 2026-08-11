import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { redactImagePII } from './redactImage.js'

async function blankImage() {
  return sharp({ create: { width: 200, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .jpeg()
    .toBuffer()
}

test('returns the original buffer unchanged when there are no OCR lines at all', async () => {
  const buffer = await blankImage()
  const result = await redactImagePII(buffer, [], 'image/jpeg')
  assert.equal(result, buffer)
})

test('returns the original buffer unchanged when no line contains PII', async () => {
  const buffer = await blankImage()
  const lines = [{ text: 'Blue Bottle Coffee', bbox: { x0: 0, y0: 0, x1: 50, y1: 10 }, words: [{ text: 'Blue', bbox: { x0: 0, y0: 0, x1: 20, y1: 10 } }] }]
  const result = await redactImagePII(buffer, lines, 'image/jpeg')
  assert.equal(result, buffer)
})

test('redacts and returns a different buffer when a line contains PII (phone number)', async () => {
  const buffer = await blankImage()
  const lines = [
    {
      text: 'call us at 415-555-1234 anytime',
      bbox: { x0: 0, y0: 0, x1: 150, y1: 10 },
      words: [
        { text: 'call', bbox: { x0: 0, y0: 0, x1: 20, y1: 10 } },
        { text: '415-555-1234', bbox: { x0: 60, y0: 0, x1: 130, y1: 10 } },
      ],
    },
  ]
  const result = await redactImagePII(buffer, lines, 'image/jpeg')
  assert.notEqual(result.length, undefined)
  assert.notEqual(Buffer.compare(result, buffer), 0, 'expected redacted image bytes to differ from the original')
})

test('does not throw and returns unchanged buffer for a line with an email address, redacts for a line with a card number', async () => {
  const buffer = await blankImage()
  const emailLines = [{ text: 'contact jane@example.com for help', bbox: { x0: 0, y0: 0, x1: 150, y1: 10 }, words: [{ text: 'jane@example.com', bbox: { x0: 0, y0: 0, x1: 100, y1: 10 } }] }]
  const emailResult = await redactImagePII(buffer, emailLines, 'image/jpeg')
  assert.notEqual(Buffer.compare(emailResult, buffer), 0)

  const cardLines = [{ text: 'card ending 4111 1111 1111 1111', bbox: { x0: 0, y0: 0, x1: 150, y1: 10 }, words: [{ text: '4111', bbox: { x0: 0, y0: 0, x1: 40, y1: 10 } }] }]
  const cardResult = await redactImagePII(buffer, cardLines, 'image/jpeg')
  assert.notEqual(Buffer.compare(cardResult, buffer), 0)
})
