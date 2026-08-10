import posthog from 'posthog-js'

// Matches family-hq/frontend/src/lib/api.js's VITE_API_URL convention.
// No auth token handling here — Coop has no login system yet.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002'

export async function submitWaitlist({ name, phone }) {
  const res = await fetch(`${API_URL}/api/waitlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Something went wrong')
  }
  // No name/phone in the event — PostHog already attaches channel, location,
  // device, OS, and UTM params to every capture automatically, and the
  // signup itself (with the name/phone) is already persisted in Supabase.
  posthog.capture('waitlist_signup')
  return res.json()
}

export async function fetchDeals() {
  const res = await fetch(`${API_URL}/api/deals`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to load deals')
  }
  const { deals } = await res.json()
  return deals
}
