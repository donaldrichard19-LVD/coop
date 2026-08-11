import cron from 'node-cron'
import { supabase } from './supabase.js'
import { fetchDeals } from './deals.js'
import { getPreferenceProfile } from './preferenceProfile.js'
import { checkSuppression } from './engagementSuppression.js'
import { archetypeForDay } from './engagementSlotPolicy.js'
import { scoreCandidates } from './engagementScoring.js'
import { recentlySentDealIds, pickNextBestUnrepeated } from './engagementRepetition.js'
import { renderEngagementTurn } from '../rcs/engagementRender.js'
import { sendAndLogEngagement, logSuppressedSend, lastUsedTemplateId, hasAlreadyAttemptedSlot } from './engagementSend.js'
import { sweepNonEngagement } from './cadenceDecay.js'

// Story A1 — the scheduler that drives the A2 -> A3 -> A4 -> A5 -> A6 -> A7 pipeline per
// account per send day. P0 scope, per the plan: fixed two-per-week cadence (Monday +
// Thursday), no per-user day optimization yet (that's P2). Runs in-process inside the
// existing coop-backend Express service via node-cron — no new service/process type.

// Date#getDay() convention: 0 = Sunday ... 6 = Saturday.
const SEND_DAYS = [1, 4] // Monday, Thursday

// Once a day, at 10:00 server time — isScheduledSendDay() below is what actually gates
// whether anything happens, so this can run daily without needing a more elaborate cron
// expression to encode "only Monday and Thursday".
const SCHEDULE_CRON = '0 10 * * *'

/** Pure — exported for testing without needing to fake the system clock inside cron. */
export function isScheduledSendDay(dayOfWeek) {
  return SEND_DAYS.includes(dayOfWeek)
}

/** Pure. One slot per calendar day is all P0's fixed two-day-a-week cadence needs — this
 * is what engagementSend.js#hasAlreadyAttemptedSlot idempotency-checks against, so a
 * crash-retry on the same day never double-sends. */
export function slotKeyForDate(now = new Date()) {
  return now.toISOString().slice(0, 10) // e.g. "2026-08-11"
}

async function fetchApprovedAccounts() {
  const { data, error } = await supabase.from('accounts').select('*').eq('status', 'approved')
  if (error) throw error
  return data
}

async function runForAccount(account, deals, slot) {
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

  const archetype = archetypeForDay(new Date().getDay())
  const scored = scoreCandidates({
    deals,
    profile,
    archetype,
    account,
    radiusOverride: suppression.preferences.radius_override,
  })
  const excludedDealIds = await recentlySentDealIds(account.id)
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
  await sendAndLogEngagement({ account, slot, archetype, deal: picked.deal, templateId, turn })
}

/**
 * Runs one full engagement batch: every approved account, through the full pipeline, for
 * today's slot. Isolates per-account failures — one account throwing doesn't abort the
 * batch for everyone else, per the plan's explicit requirement. Exported (not just
 * triggered by the cron schedule) so it can be invoked directly for manual testing/ops,
 * matching server.js's existing /api/analyze/trigger-style manual-trigger convention seen
 * in the sibling Calvin codebase.
 */
export async function runEngagementBatch(now = new Date()) {
  if (!isScheduledSendDay(now.getDay())) {
    console.log('[engagementScheduler] not a scheduled send day — skipping batch')
    return
  }

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
      await runForAccount(account, deals, slot)
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
    // by isScheduledSendDay like runEngagementBatch above), since it's evaluating PAST
    // sends whose 48-hour windows may elapse on any day, not just a send day.
    sweepNonEngagement().catch((err) => console.error('[engagementScheduler] non-engagement sweep failed:', err.message))
  })
  console.log(`[engagementScheduler] scheduled ("${SCHEDULE_CRON}", send days: Mon/Thu)`)
}
