import { supabase } from './supabase.js'
import { timezoneForZip } from './zipTimezone.js'
import { recordConsent } from './consent.js'

// Normalizes a raw inbound phone value to E.164 (+1XXXXXXXXXX). Handles both
// bare 10-digit US numbers ("4155551234") and 11-digit values with a leading
// country code "1" — the latter is how Twilio's inbound `From` field arrives
// for RCS/SMS (e.g. "+14155551234" -> digits "14155551234"). Strip the
// leading 1 before validating length so both shapes normalize the same way;
// anything that still isn't 10 digits after that is not a valid US number.
export function normalizePhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1)
  }
  if (digits.length !== 10) return null
  return `+1${digits}`
}

// phone must already be normalized (E.164, +1XXXXXXXXXX) before calling this.
// Looks up an account by phone; returns it untouched if found. Otherwise
// inserts a new pending account and returns the inserted row. Not race-proof
// (a concurrent double-insert is possible under load) but fine at Coop's
// current scale — matches the simplicity of the rest of this codebase.
export async function resolveOrCreateAccount(phone) {
  const { data: existing, error: selectError } = await supabase
    .from('accounts')
    .select('*')
    .eq('phone', phone)
    .maybeSingle()
  if (selectError) throw selectError
  if (existing) return existing

  const { data: created, error: insertError } = await supabase
    .from('accounts')
    .insert({ phone, name: null, status: 'pending' })
    .select('*')
    .single()
  if (insertError) throw insertError
  return created
}

// Story A0/A8 — the single place accounts.status transitions to 'approved'. Previously
// this was an inline `.update({ status: 'approved' })` in routes/waitlist.js's /approve
// handler; centralized here so the zip/timezone capture and consent write happen exactly
// once, at the one real approval moment, no matter which caller triggers it.
//
// zipCode is optional and manually supplied by Donald at approval time (see BACKLOG.md —
// there is no self-serve location-collection UI, and this is already a manual,
// Donald-operated flow, so a parameter addition here is consistent with how it works
// today). When present, timezone is derived deterministically via zipTimezone.js rather
// than looked up from a live geocoding service, per the build plan's guardrail #1.
//
// Also the point a consent_records row is written (Story A8's requirement that consent.js
// writes a record when the approval flow runs) — this manual approval IS the consent event
// today, there's no separate self-serve opt-in step to hang it off of instead.
export async function approveAccount(phone, { zipCode } = {}) {
  const update = { status: 'approved' }
  if (zipCode) {
    update.zip_code = zipCode
    const tz = timezoneForZip(zipCode)
    if (tz) update.timezone = tz
    else console.error(`[accounts] zip "${zipCode}" did not resolve to a known timezone — zip_code saved, timezone left null`)
  }

  const { data, error } = await supabase.from('accounts').update(update).eq('phone', phone).select('*').maybeSingle()
  if (error) throw error
  if (!data) return null

  await recordConsent(data.id, 'waitlist_approval')
  return data
}
