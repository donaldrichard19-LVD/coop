import { PostHog } from 'posthog-node'

// null when unconfigured (e.g. local dev without keys set) — callers no-op
// rather than throwing, same resilience convention as the waitlist DB/email
// writes in routes/waitlist.js.
const client = process.env.POSTHOG_API_KEY
  ? new PostHog(process.env.POSTHOG_API_KEY, { host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com' })
  : null

// distinctId is the account's phone (E.164) — this is what ties server-side
// account-state events (pending/approved) to a real Coop account, unlike the
// anonymous browser-generated distinct_id behind the frontend's
// 'waitlist_signup' capture in src/lib/api.js. Flushed immediately: waitlist
// volume is low enough that per-event flush cost doesn't matter, and it
// avoids losing buffered events if the dyno restarts before the default
// flush interval.
export async function captureAccountEvent(event, phone, properties = {}) {
  if (!client) return
  client.capture({ distinctId: phone, event, properties })
  try {
    await client.flush()
  } catch (err) {
    console.error(`[posthog] flush failed for event "${event}":`, err.message)
  }
}
