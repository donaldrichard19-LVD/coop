import { supabase } from './supabase.js'
import { anthropic } from './anthropic.js'
import { defaultEngagementPreferences, getEngagementPreferences } from './engagementSuppression.js'

// Story A10 — the soft opt-out ladder: lower-severity signals than a hard STOP (A8) that
// adjust engagement_preferences instead of fully blocking sends. Wired into routes/rcs.js
// after A9's classifier.

const TOO_MANY_RE = /\b(too many (texts|messages|deals)|too much texting|slow down|cut back|fewer texts|less texting)\b/i
const WRONG_FOOD_RE = /\b(wrong (food|cuisine|kind of food)|not (my|into) (food|thing|cuisine)|don'?t (eat|like) (this|that))\b/i
const WRONG_MERCHANT_RE = /\b(not (that|this) (place|spot)|wrong (place|spot)|don'?t (go|shop) there|never go there)\b/i
const TOO_FAR_RE = /\b(too far|not (close|near)( enough)?|far away|out of (my )?way)\b/i
const NOT_NOW_RE = /\b(not now|not right now|maybe later|pause (this|for now)|hold off)\b/i

const CADENCE_STEP_DOWN = { standard: 'reduced', reduced: 'minimal', minimal: 'minimal' }
const SNOOZE_DAYS = 30
const DEFAULT_RADIUS_MILES = 10
const RADIUS_STEP_FACTOR = 0.5
const MIN_RADIUS_MILES = 1

/**
 * Pure classifier. Checked in the order the plan lists the ladder — "too many" first,
 * since it's the least ambiguous/most common complaint, then the merchant/food/distance
 * exclusions, then "not now". Returns { action, keyword } or null if nothing in the ladder
 * matched (caller falls back to classifyAmbiguousNegativeFeedback below).
 */
export function classifySoftOptOut(body) {
  const text = String(body || '').trim()
  if (!text) return null
  if (TOO_MANY_RE.test(text)) return { action: 'reduce_cadence', keyword: TOO_MANY_RE.exec(text)[0] }
  if (WRONG_FOOD_RE.test(text)) return { action: 'exclude_category', keyword: WRONG_FOOD_RE.exec(text)[0] }
  if (WRONG_MERCHANT_RE.test(text)) return { action: 'exclude_merchant', keyword: WRONG_MERCHANT_RE.exec(text)[0] }
  if (TOO_FAR_RE.test(text)) return { action: 'reduce_radius', keyword: TOO_FAR_RE.exec(text)[0] }
  if (NOT_NOW_RE.test(text)) return { action: 'snooze', keyword: NOT_NOW_RE.exec(text)[0] }
  return null
}

// Cheap, deterministic pre-gate before ever paying for a model call: only messages that
// already carry *some* negative-toned word are candidates for
// classifyAmbiguousNegativeFeedback. An ordinary search query ("what's good tonight")
// essentially never matches this, so the vast majority of non-soft-opt-out traffic never
// reaches the model at all — same deterministic-first cost discipline the rest of this
// pipeline already follows (screenshotParser.js, itemNormalization.js).
const NEGATIVE_TONE_HINT_RE = /\b(no|nope|don'?t|stop|ugh|meh|sick of|tired of|annoying|not (interested|into it)|bleh|ew)\b/i

export function mightBeNegativeFeedback(body) {
  return NEGATIVE_TONE_HINT_RE.test(String(body || ''))
}

/**
 * Model call, used only when classifySoftOptOut found no explicit keyword AND
 * mightBeNegativeFeedback's cheap regex gate passed. Returns { negative, confidence } —
 * confidence in [0,1]. Degrades gracefully without ANTHROPIC_API_KEY (throws, caller
 * catches and defaults toward cadence reduction per the plan's explicit fallback rule,
 * same "default toward the safer/more conservative outcome on uncertainty" reasoning used
 * elsewhere in this build, e.g. engagementSuppression.js's fail-safe error handling).
 */
export async function classifyAmbiguousNegativeFeedback(body) {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 128,
    messages: [
      {
        role: 'user',
        content: `A user replied to a proactive deal-alert text with this message: ${JSON.stringify(String(body || ''))}\n\nDoes this message express a desire to receive fewer/no more of these proactive texts (as opposed to, say, a new search request or an unrelated comment)? Return ONLY JSON: {"negative": boolean, "confidence": number between 0 and 1}. No markdown, no prose.`,
      },
    ],
  })
  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock) throw new Error('No text response from Claude')
  const cleaned = textBlock.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  return JSON.parse(cleaned)
}

const LOW_CONFIDENCE_THRESHOLD = 0.5

async function upsertPreferences(accountId, patch) {
  const current = await getEngagementPreferences(accountId)
  const next = { ...defaultEngagementPreferences(accountId), ...current, ...patch, updated_at: new Date().toISOString() }
  const { error } = await supabase.from('engagement_preferences').upsert(next, { onConflict: 'account_id' })
  if (error) console.error('[softOptOut] failed to upsert engagement_preferences:', error.message)
  return next
}

async function recordSoftOptOut({ accountId, keyword, body }) {
  const { error } = await supabase
    .from('opt_out_records')
    .insert({ account_id: accountId, type: 'soft', keyword_matched: keyword || null, message_body: body })
  if (error) console.error('[softOptOut] failed to record soft opt-out:', error.message)
}

/**
 * Applies one rung of the soft opt-out ladder. `lastSentDeal` (the most recent deal shown
 * to this account, e.g. via session.js#getLastTurnDeals or the last engagement_sends row)
 * is required for exclude_category/exclude_merchant — those actions only make sense
 * relative to *what was just shown*, which the message text alone doesn't carry.
 */
export async function applySoftOptOut({ account, action, keyword, body, lastSentDeal }) {
  await recordSoftOptOut({ accountId: account.id, keyword, body })

  switch (action) {
    case 'reduce_cadence': {
      const current = await getEngagementPreferences(account.id)
      const nextTier = CADENCE_STEP_DOWN[current.cadence_tier] || 'reduced'
      await upsertPreferences(account.id, { cadence_tier: nextTier })
      return { acknowledged: true, message: "got it, we'll ease up on texts." }
    }
    case 'exclude_category': {
      if (!lastSentDeal?.category) return { acknowledged: false, message: null }
      const current = await getEngagementPreferences(account.id)
      const categories = new Set(current.excluded_categories || [])
      categories.add(lastSentDeal.category)
      await upsertPreferences(account.id, { excluded_categories: [...categories] })
      return { acknowledged: true, message: `noted — we'll skip ${lastSentDeal.category} deals.` }
    }
    case 'exclude_merchant': {
      if (!lastSentDeal?.merchant?.name) return { acknowledged: false, message: null }
      const current = await getEngagementPreferences(account.id)
      const merchants = new Set(current.excluded_merchants || [])
      merchants.add(lastSentDeal.merchant.name)
      await upsertPreferences(account.id, { excluded_merchants: [...merchants] })
      return { acknowledged: true, message: `noted — we'll leave ${lastSentDeal.merchant.name} out.` }
    }
    case 'reduce_radius': {
      const current = await getEngagementPreferences(account.id)
      const currentRadius = current.radius_override || DEFAULT_RADIUS_MILES
      const nextRadius = Math.max(MIN_RADIUS_MILES, currentRadius * RADIUS_STEP_FACTOR)
      await upsertPreferences(account.id, { radius_override: nextRadius })
      // Persisted even though radius enforcement itself is a pass-through today (guardrail
      // #1) — so the preference is ready the moment real geo lands, per the plan.
      return { acknowledged: true, message: "got it, we'll keep it closer to home." }
    }
    case 'snooze': {
      const snoozedUntil = new Date(Date.now() + SNOOZE_DAYS * 86_400_000).toISOString()
      await upsertPreferences(account.id, { snoozed_until: snoozedUntil })
      return { acknowledged: true, message: "no worries — we'll hold off for a bit and check back in a few weeks." }
    }
    default:
      return { acknowledged: false, message: null }
  }
}

/**
 * Handles the ambiguous-negative-feedback case: no explicit ladder keyword matched, but the
 * cheap regex gate suggests it's worth a model call. Defaults toward cadence reduction when
 * confidence is low OR the model call fails entirely — the plan's explicit fallback rule,
 * since under-reacting to a real complaint (never easing up) is a worse failure mode than
 * over-reacting to a false positive (easing up once when it wasn't strictly necessary).
 */
export async function applyAmbiguousNegativeFeedback({ account, body }) {
  let classification
  try {
    classification = await classifyAmbiguousNegativeFeedback(body)
  } catch (err) {
    console.error('[softOptOut] ambiguous-feedback model call failed — defaulting to cadence reduction:', err.message)
    return applySoftOptOut({ account, action: 'reduce_cadence', keyword: null, body })
  }

  if (!classification.negative) return { acknowledged: false, message: null }

  // Unlike the explicit ladder in classifySoftOptOut, there's no keyword here to route to a
  // *specific* rung (wrong food vs. too far vs. not now) — only a general "this reads as
  // negative" signal. cadence reduction is the one action that's a safe, generically
  // correct response to unspecified negative feedback regardless of confidence level; per
  // the plan, low confidence still resolves toward this same conservative action rather
  // than taking no action at all (logged here so the confidence value isn't silently
  // discarded, even though it doesn't change which action is taken).
  if (classification.confidence < LOW_CONFIDENCE_THRESHOLD) {
    console.log(`[softOptOut] low-confidence (${classification.confidence}) negative feedback — defaulting to cadence reduction`)
  }
  return applySoftOptOut({ account, action: 'reduce_cadence', keyword: null, body })
}
