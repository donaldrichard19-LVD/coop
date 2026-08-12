import { supabase } from './supabase.js'

// The RCS status-callback webhook (routes/rcs.js POST /status) — separate from the
// inbound-message webhook (POST /webhook). Twilio calls this asynchronously, once per
// status transition (queued -> sending -> sent -> delivered, or -> undelivered/failed with
// an error code), for every message sent via the Messaging Service this URL is configured
// against in the Twilio console. Requires that console-side configuration to actually
// receive anything — this file has no way to make Twilio start calling it.

/**
 * Pure. Twilio's status-callback body (form-urlencoded, same convention as the inbound
 * webhook) as `req.body` — extracts and validates just the fields this app persists.
 * Returns null if the payload is missing the two fields that make a row meaningful
 * (MessageSid to key on, MessageStatus to record) rather than writing a garbage row.
 */
export function parseDeliveryStatusPayload(body) {
  const messageSid = body?.MessageSid
  const status = body?.MessageStatus
  if (!messageSid || !status) return null

  return {
    messageSid,
    status,
    toPhone: body.To || null,
    errorCode: body.ErrorCode || null,
    errorMessage: body.ErrorMessage || null,
  }
}

/**
 * Upserts on message_sid — Twilio calls the status webhook multiple times per message as
 * it progresses through statuses, and each call should overwrite the row's current status
 * rather than accumulate duplicates. created_at is intentionally left alone on conflict
 * (only set on the initial insert) so it still reflects first-seen time; updated_at always
 * moves forward.
 */
export async function recordDeliveryStatus(parsed) {
  const { error } = await supabase.from('message_delivery_status').upsert(
    {
      message_sid: parsed.messageSid,
      to_phone: parsed.toPhone,
      status: parsed.status,
      error_code: parsed.errorCode,
      error_message: parsed.errorMessage,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'message_sid' },
  )
  if (error) console.error('[deliveryStatus] failed to upsert message_delivery_status:', error.message)
}
