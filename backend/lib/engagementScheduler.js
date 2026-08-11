import cron from 'node-cron'
import { supabase } from './supabase.js'
import { fetchDeals } from './deals.js'
import { getPreferenceProfile } from './preferenceProfile.js'
import { checkSuppression } from './engagementSuppression.js'
import { archetypeForDay } from './engagementSlotPolicy.js'
import { scoreCandidates, scoreCandidatesControlGroup } from './engagementScoring.js'
import { recentlySentDealIds, pickNextBestUnrepeated, repetitionWindowDaysFor } from './engagementRepetition.js'
import { renderEngagementTurn } from '../rcs/engagementRender.js'
import {
  sendAndLogEngagement,
  logSuppressedSend,
  lastUsedTemplateId,
  lastSentMerchantName,
  hasAlreadyAttemptedSlot,
} from './engagementSend.js'
import { sweepNonEngagement } from './cadenceDecay.js'
import { reevaluateAllThirdSendEligibility } from './thirdSendEligibility.js'
import { resolveSendDays } from './engagementDayOptimization.js'

// Story A1 — the scheduler that drives the A2 -> A3 -> A4 -> A5 -> A6 -> A7 pipeline per
// account per send day. Originally P0 scope was a fixed two-per-week cadence (Monday +
// Thursday) for every account; Story P2-2/P2-3 (per-user day/time optimization and an
// earned 3rd weekly send) made send-day assignment per-account instead of global, so the
// cron tick itself now runs every day and each account's OWN resolved send days (see
// resolveSendDays below) decide whether today counts for them — not a single shared
// Mon/Thu gate on the whole batch anymore. Runs in-process inside the existing
// coop-backend Express service via node-cron — no new service/process type.

// Date#getDay() convention: 0 = Sunday ... 6 = Saturday.
export const SEND_DAYS = [1, 4] // Monday, Thursday — the fixed 2x/week default
export const SEND_DAYS_3X = [1, 3, 5] // Monday, Wednesday, Friday — the earned 3rd-send default (Story P2-3)

// Once a day, at 10:00 server time. Previously this needed to encode "only Monday and
// Thursday" via isScheduledSendDay's gate on the whole batch; now every account's
// personalized/default send days are evaluated per-account inside runForAccount, so a plain
// daily tick is what's needed regardless of any single account's schedule.
const SCHEDULE_CRON = '0 10 * * *'

/** Pure — exported for testing without needing to fake the system clock inside cron. Kept
 * for backward compatibility (still describes the fixed 2x/week default), though the
 * scheduler itself no longer gates the whole batch on this — see runEngagementBatch. */
export function isScheduledSendDay(dayOfWeek) {
  return SEND_DAYS.includes(dayOfWeek)
}

/** Pure. Story P2-3's "how many weekly send slots does this account currently get" —
 * earned_third_send is an independent axis from cadence_tier (which per A11 only ever
 * decays), so a 3rd send requires BOTH: earned AND not currently decayed off 'standard'.
 * Control-group accounts (Story P2-5) never get a 3rd send, full stop, regardless of their
 * rolling-engagement window — checked here once so it isn't duplicated at every call site
 * that needs a slot count. */
export function effectiveSendCount(preferences) {
  if (preferences?.is_control_group) return 2
  if (preferences?.cadence_tier !== 'standard') return 2
  return preferences?.earned_third_send ? 3 : 2
}

/** Pure. The fixed fallback send days for a given effective send count — Mon/Thu at 2x,
 * Mon/Wed/Fri once a 3rd send is earned (Story P2-3). This is what resolveSendDays falls
 * back to when personalization (Story P2-2) doesn't apply or doesn't have enough signal. */
export function defaultSendDaysFor(count) {
  return count >= 3 ? SEND_DAYS_3X : SEND_DAYS
}

/** Pure. One slot per calendar day is all any one account's send cadence needs (2x or 3x
 * per week both resolve to a single day-of-week check, not multiple sends on the same day)
 * — this is what engagementSend.js#hasAlreadyAttemptedSlot idempotency-checks against, so a
 * crash-retry on the same day never double-sends. */
export function slotKeyForDate(now = new Date()) {
  return now.toISOString().slice(0, 10) // e.g. "2026-08-11"
}

async function fetchApprovedAccounts() {
  const { data, error } = await supabase.from('accounts').select('*').eq('status', 'approved')
  if (error) throw error
  return data
}

async function runForAccount(account, deals, slot, now) {
  if (await hasAlreadyAttemptedSlot(account.id, slot)) {
    console.log(`[engagementScheduler] ${account.id} already attempted slot ${slot} — skipping (idempotency)`)
    return
  }

  const profile = await getPreferenceProfile(account.id)
  const suppression = await checkSuppression({ account, profile, deals })
  if (suppression.suppressed) {
    await logSuppressedSend({ accountId: account.id, slot, reason: suppression.reason })
    return
  }

  const preferences = suppression.preferences
  const sendCount = effectiveSendCount(preferences)
  const sendDays = resolveSendDays({ profile, preferences, effectiveSendCount: sendCount, defaultDays: defaultSendDaysFor(sendCount) })
  if (!sendDays.includes(now.getDay())) {
    // Not this account's (personalized or default) send day today — re-evaluated fresh on
    // tomorrow's tick, per Story P2-2's "re-evaluate every tick" requirement. Not logged as
    // a suppressed-send row: nothing was attempted or blocked, it's simply not this
    // account's turn today.
    return
  }

  const archetype = archetypeForDay(now.getDay())
  const recentMerchantName = await lastSentMerchantName(account.id)
  const scored = preferences.is_control_group
    ? scoreCandidatesControlGroup({ deals, account, radiusOverride: preferences.radius_override, recentMerchantName })
    : scoreCandidates({ deals, profile, archetype, account, radiusOverride: preferences.radius_override, recentMerchantName })

  const windowDays = repetitionWindowDaysFor(sendCount)
  const excludedDealIds = await recentlySentDealIds(account.id, windowDays)
  const picked = pickNextBestUnrepeated(scored, excludedDealIds)
  if (!picked) {
    // Every candidate was recently sent — an inventory-floor suppression, distinct from
    // "nothing scored well" (which would still have picked the least-bad candidate).
    await logSuppressedSend({ accountId: account.id, slot, reason: 'inventory_floor' })
    return
  }

  const lastTemplateId = await lastUsedTemplateId(account.id)
  const { turn, templateId } = renderEngagementTurn({
    archetype,
    deal: picked.deal,
    seed: `${account.id}:${slot}`,
    lastTemplateId,
  })
  await sendAndLogEngagement({ account, slot, archetype, deal: picked.deal, templateId, turn, isControlGroup: preferences.is_control_group })
}

/**
 * Runs one full engagement batch: every approved account, through the full pipeline, for
 * today's slot. Runs unconditionally every day (see the header comment above — per-account
 * send-day eligibility is decided inside runForAccount, not by a batch-level gate anymore).
 * Isolates per-account failures — one account throwing doesn't abort the batch for everyone
 * else, per the plan's explicit requirement. Exported (not just triggered by the cron
 * schedule) so it can be invoked directly for manual testing/ops, matching server.js's
 * existing /api/analyze/trigger-style manual-trigger convention seen in the sibling Calvin
 * codebase.
 */
export async function runEngagementBatch(now = new Date()) {
  let accounts
  try {
    accounts = await fetchApprovedAccounts()
  } catch (err) {
    console.error('[engagementScheduler] failed to load approved accounts:', err.message)
    return
  }

  let deals
  try {
    deals = await fetchDeals()
  } catch (err) {
    console.error('[engagementScheduler] failed to fetch deals:', err.message)
    return
  }

  const slot = slotKeyForDate(now)
  console.log(`[engagementScheduler] running batch for slot ${slot}, ${accounts.length} approved account(s)`)

  for (const account of accounts) {
    try {
      await runForAccount(account, deals, slot, now)
    } catch (err) {
      console.error(`[engagementScheduler] account ${account.id} failed, continuing batch:`, err.message)
    }
  }
}

/** Wires the cron job. Call once at server boot (see server.js). */
export function startEngagementScheduler() {
  cron.schedule(SCHEDULE_CRON, () => {
    runEngagementBatch().catch((err) => console.error('[engagementScheduler] batch run failed:', err.message))
    // Story A11's non-engagement sweep rides this same daily cron tick rather than a
    // second scheduled job, per the plan — it runs unconditionally every tick (not gated
    // by any particular send day like runForAccount's per-account gate), since it's
    // evaluating PAST sends whose 48-hour windows may elapse on any day, not just a send
    // day. Story P2-1's off-ramp offer is checked from inside this same sweep — see
    // cadenceDecay.js's call site.
    sweepNonEngagement().catch((err) => console.error('[engagementScheduler] non-engagement sweep failed:', err.message))
    // Story P2-3 — re-evaluates every approved account's rolling 3-send engagement window
    // fresh every tick, same "runs unconditionally every day" reasoning as the sweep above.
    reevaluateAllThirdSendEligibility().catch((err) => console.error('[engagementScheduler] third-send eligibility sweep failed:', err.message))
  })
  console.log(`[engagementScheduler] scheduled ("${SCHEDULE_CRON}", daily — per-account send days, see engagementDayOptimization.js)`)
}
