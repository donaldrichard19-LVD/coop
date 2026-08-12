import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDeliveryStatusPayload } from './deliveryStatus.js'

test('parses a normal delivered callback', () => {
  const parsed = parseDeliveryStatusPayload({ MessageSid: 'SM123', MessageStatus: 'delivered', To: '+15551234567' })
  assert.deepEqual(parsed, { messageSid: 'SM123', status: 'delivered', toPhone: '+15551234567', errorCode: null, errorMessage: null })
})

test('captures error fields on a failed callback', () => {
  const parsed = parseDeliveryStatusPayload({
    MessageSid: 'SM123',
    MessageStatus: 'failed',
    To: '+15551234567',
    ErrorCode: '30007',
    ErrorMessage: 'Carrier violation',
  })
  assert.equal(parsed.errorCode, '30007')
  assert.equal(parsed.errorMessage, 'Carrier violation')
})

test('returns null when MessageSid is missing', () => {
  assert.equal(parseDeliveryStatusPayload({ MessageStatus: 'delivered' }), null)
})

test('returns null when MessageStatus is missing', () => {
  assert.equal(parseDeliveryStatusPayload({ MessageSid: 'SM123' }), null)
})

test('returns null on an empty/undefined body', () => {
  assert.equal(parseDeliveryStatusPayload(undefined), null)
  assert.equal(parseDeliveryStatusPayload({}), null)
})
