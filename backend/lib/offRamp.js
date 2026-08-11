import { supabase } from './supabase.js'
import { sendRcsTurn } from './twilioClient.js'
import { isHardOptedOut } from './optOut.js'
import { defaultEngagementPreferences, getEngagementPreferences } from './engagementSuppression.js'

// Story P2-1 — pre-emptive off-ramp. Fires BEFORE cadenceDecay.js's automatic cadence-tier
// step-down (CADENCE_DECAY_THRESHOLD = 4): after OFF_RAMP_THRESHOLD (2) consecutive
// non-engaged scheduled sends, offer the account the same preference-ladder levers
// softOptOut.js already understands (fewer texts, different food, stop entirely) instead of
// silently reducing cadence for them. An offer, not an automatic action — the account has to
// reply for anything to actually change; softOptOut.js's existing ladder handles that reply
// the same way it handles any other soft-opt-out message.
//
// Named/sized the same way CADENCE_DECAY_THRESHOLD is in cadenceDecay.js, kept in this
// sibling module rather than folded into that file: cadenceDecay.js's job is purely
// send-outcome accounting (increment/reset a counter, step a tier), while this module also
// sends a message and writes a distinct event log — different enough responsibilities that
// splitting them keeps each file's job legible, matching this codebase's established
// pattern of separating "decide" from "act" across files (engagementSuppression.js's pure
// core vs. lib/optOut.js's send-and-record flow).

export const OFF_RAMP_THRESHOLD = 2

const OFF_RAMP_MESSAGE =
  "haven't heard back in a bit — want fewer texts, different kinds of deals, or should we stop texting you altogether? just reply and we'll sort it out."

/**
 * Pure. Given the account's current non-engaged streak length and whether the off-ramp has
 * already fired for THIS streak (engagement_preferences.off_ramp_sent_at, nulled whenever
 * cadenceDecay.js#recordEngagedSend resets the streak), decides whether the off-ramp offer
 * should fire now. Fires once per streak, not once per non-engaged send — once
 * offRampSentAt is set, this returns false for every subsequent send in the same streak,
 * even as the counter keeps climbing toward CADENCE_DECAY_THRESHOLD.
 */
export function shouldFireOffRamp({ consecutiveNonEngagedSends, offRampSentAt }) {
  if (offRampSentAt) return false
  return (consecutiveNonEngagedSends || 0) >= OFF_RAMP_THRESHOLD
}

async function upsertPreferences(accountId, patch) {
  const current = await getEngagementPreferences(accountId)
  const next = { ...defaultEngagementPreferences(accountId), ...current, ...patch, updated_at: new Date().toISOString() }
  const { error } = await supabase.from('engagement_preferences').upsert(next, { onConflict: 'account_id' })
  if (error) console.error('[offRamp] failed to upsert engagement_preferences:', error.message)
  return next
}

async function logOffRampEvent(accountId, consecutiveNonEngagedSends) {
  const { error } = await supabase
    .from('off_ramp_events')
    .insert({ account_id: accountId, consecutive_non_engaged_sends: consecutiveNonEngagedSends })
  if (error) console.error('[offRamp] failed to log off_ramp_events row:', error.message)
}

/**
 * Called from cadenceDecay.js#sweepNonEngagement right after a non-engaged send is
 * recorded (i.e. after the counter has just been incremented) — see that file's call site.
 * Checks shouldFireOffRamp against the freshly-updated preferences; if it fires, sends the
 * plain templated offer (never model-generated, per the plan) via the same sendRcsTurn path
 * every other proactive send uses, logs a distinct off_ramp_events row, and stamps
 * off_ramp_sent_at so this streak doesn't fire again. Respects isHardOptedOut, same as
 * every other proactive send in this codebase (lib/optOut.js, engagementScheduler.js).
 */
export async function maybeFireOffRamp(accountId) {
  const prefs = await getEngagementPreferences(accountId)
  if (!shouldFireOffRamp({ consecutiveNonEngagedSends: prefs.consecutive_non_engaged_sends, offRampSentAt: prefs.off_ramp_sent_at })) {
    return
  }

  if (await isHardOptedOut(accountId)) return

  const { data: account, error } = await supabase.from('accounts').select('id, phone').eq('id', accountId).maybeSingle()
  if (error || !account?.phone) {
    console.error(`[offRamp] failed to load account ${accountId} for off-ramp send:`, error?.message)
    return
  }

  console.log(`[offRamp] account ${accountId}: ${prefs.consecutive_non_engaged_sends} consecutive non-engaged sends -> firing off-ramp offer`)
  await sendRcsTurn(account.phone, { text: OFF_RAMP_MESSAGE, deals: [], quickReplies: [] })
  await logOffRampEvent(accountId, prefs.consecutive_non_engaged_sends)
  await upsertPreferences(accountId, { off_ramp_sent_at: new Date().toISOString() })
}
