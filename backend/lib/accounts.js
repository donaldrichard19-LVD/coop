import { supabase } from './supabase.js'

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
