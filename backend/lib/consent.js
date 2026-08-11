import { supabase } from './supabase.js'

// Story A0/A8 — writes one consent_records row at the exact moment an account's approval
// flow (lib/accounts.js's approveAccount) sets status to 'approved'. That manual,
// Donald-operated approval IS the consent event today — there is no separate self-serve
// opt-in flow to hang this off of instead.
export async function recordConsent(accountId, context = 'waitlist_approval') {
  const { error } = await supabase.from('consent_records').insert({ account_id: accountId, context })
  if (error) console.error('[consent] failed to record consent:', error.message)
}
