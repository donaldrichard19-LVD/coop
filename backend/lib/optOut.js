import { supabase } from './supabase.js'
import { sendRcsTurn } from './twilioClient.js'

// Story A8 — the P0 hard compliance blocker. classifyCompliance is pure and unit-tested
// (see optOut.test.js) so the keyword logic can be verified without credentials or a live
// webhook. Matches the keyword even mid-sentence ("please stop texting me"), per explicit
// product requirement — these are word-bounded, not anchored to the whole message.
//
// Longer/more-specific alternatives are listed before their substrings within each
// alternation (stopall before stop) so the regex engine's left-to-right alternative
// preference picks the more specific match at a given position.
const STOP_RE = /\b(stop\s*all|stopall|stop|unsubscribe|cancel|end|quit)\b/i
const RESUME_RE = /\b(unstop|start)\b/i
const HELP_RE = /\bhelp\b/i

/**
 * Pure classifier — no I/O. Returns { type: 'stop'|'resume'|'help', keyword } or null if
 * the message body contains no compliance keyword. Order matters: STOP-family checked
 * before RESUME/HELP, mirroring standard carrier/TCPA keyword precedence.
 */
export function classifyCompliance(body) {
  const text = String(body || '').trim()
  if (!text) return null
  const stopMatch = STOP_RE.exec(text)
  if (stopMatch) return { type: 'stop', keyword: stopMatch[0].toLowerCase().replace(/\s+/g, '') }
  const resumeMatch = RESUME_RE.exec(text)
  if (resumeMatch) return { type: 'resume', keyword: resumeMatch[0].toLowerCase() }
  const helpMatch = HELP_RE.exec(text)
  if (helpMatch) return { type: 'help', keyword: 'help' }
  return null
}

// In-memory fast-path set of hard-opted-out account ids — same convention and same
// caveat as session.js/pendingConfirmations.js (not race-proof across processes, doesn't
// survive a restart). Exists specifically so a STOP is honored *within the same process
// tick* for any send that might otherwise be mid-flight (e.g. a scheduler batch run
// currently iterating accounts), satisfying A8's "suppress any pending/queued send
// immediately" requirement without needing a real job queue. isHardOptedOut() below falls
// back to the database (the actual source of truth) whenever this cache is cold, so a
// process restart never silently re-enables a still-active opt-out.
const optedOutAccountIds = new Set()

/**
 * Source of truth for "is this account currently hard-opted-out". Checked by
 * engagementSuppression.js (A2) before every scheduled send, and by the B5 re-notification
 * push path directly. Fails safe: a Supabase error is treated as opted-out, since letting a
 * DB hiccup silently allow a suppressed account to receive a message is the worse failure
 * mode of the two.
 */
export async function isHardOptedOut(accountId) {
  if (optedOutAccountIds.has(accountId)) return true

  const { data, error } = await supabase
    .from('opt_out_records')
    .select('id')
    .eq('account_id', accountId)
    .eq('type', 'hard')
    .is('resumed_at', null)
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[optOut] hard opt-out lookup failed — failing safe (treating as opted out):', error.message)
    return true
  }
  if (data) {
    optedOutAccountIds.add(accountId) // warm the cache for subsequent checks this process
    return true
  }
  return false
}

async function handleStop({ phone, account, body, keyword }) {
  optedOutAccountIds.add(account.id) // immediate, synchronous suppression — see comment above

  const { error } = await supabase
    .from('opt_out_records')
    .insert({ account_id: account.id, type: 'hard', keyword_matched: keyword, message_body: body })
  if (error) console.error('[optOut] failed to persist hard opt-out:', error.message)

  // Exactly one confirmation, sent via the plain turn shape (no deals, no chips) — this
  // must never look like an engagement message and must never route through anything the
  // engagement pipeline's own suppression/dedup logic would apply to it.
  await sendRcsTurn(phone, {
    text: "you're unsubscribed from Coop texts. reply START to opt back in.",
    deals: [],
    quickReplies: [],
  })
}

async function handleResume({ phone, account }) {
  optedOutAccountIds.delete(account.id)

  const { error } = await supabase
    .from('opt_out_records')
    .update({ resumed_at: new Date().toISOString() })
    .eq('account_id', account.id)
    .eq('type', 'hard')
    .is('resumed_at', null)
  if (error) console.error('[optOut] failed to resume account:', error.message)

  await sendRcsTurn(phone, { text: "you're back in — we'll start texting deals again.", deals: [], quickReplies: [] })
}

async function handleHelp(phone) {
  await sendRcsTurn(phone, {
    text: 'Coop sends deal alerts for merchants you shop at. Msg & data rates may apply. Reply STOP to unsubscribe.',
    deals: [],
    quickReplies: [],
  })
}

/**
 * Single entrypoint routes/rcs.js's webhook handler calls as the very first thing after
 * resolving/creating the account (account resolution itself is not "inbound logic" — it's
 * the minimal lookup needed to have an account_id to write against). Must run before the
 * account-approval gate, before A9's classifier, before any model call, under all
 * circumstances. Returns true if the message was a compliance message and was fully
 * handled — caller must return immediately with no further processing. Returns false for
 * an ordinary message that should proceed through the rest of the pipeline.
 */
export async function handleComplianceMessage({ phone, account, body }) {
  const classification = classifyCompliance(body)
  if (!classification) return false

  if (classification.type === 'stop') {
    await handleStop({ phone, account, body, keyword: classification.keyword })
    return true
  }
  if (classification.type === 'resume') {
    await handleResume({ phone, account })
    return true
  }
  await handleHelp(phone)
  return true
}
