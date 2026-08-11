import { fetchDeals } from './deals.js'
import { scoreCandidates } from './engagementScoring.js'
import { ARCHETYPES } from './engagementSlotPolicy.js'
import { renderEngagementTurn } from '../rcs/engagementRender.js'
import { extractIntent } from './intentExtraction.js'
import { anthropic } from './anthropic.js'

// Story A14 — on-demand retrieval + reply for search-shaped inbound messages (A9's
// search_or_unclassifiable fallback bucket). Reuses A4's scoring engine with A13's
// extracted filters in place of a slot-policy archetype bias, replies via A6's template
// library, and — critically — does NOT write to engagement_sends (Story A7's log), so it
// never counts against A2's frequency cap: this is a user-initiated pull, not a scheduled
// push, and the two must stay accounted separately.

/**
 * Pure. Narrows a deal list to ones matching A13's extracted filters. maxDistanceMiles is
 * accepted but not enforced — merchants have no coordinates (guardrail #1, same permissive
 * gap engagementScoring.js#isWithinRadius already documents), so a distance filter can't be
 * applied for real yet; it's threaded through describeConstraints() so at least the
 * constraint is *echoed back* honestly even though it isn't yet *enforced*.
 */
export function applyIntentFilters(deals, filters) {
  return deals.filter((deal) => {
    if (filters.category && deal.category !== filters.category) return false
    if (filters.merchant && !deal.merchant?.name?.toLowerCase().includes(filters.merchant.toLowerCase())) return false
    if (filters.maxPrice != null && deal.originalPrice != null && deal.originalPrice > filters.maxPrice) return false
    if (filters.minPrice != null && (deal.originalPrice ?? 0) < filters.minPrice) return false
    return true
  })
}

/** Pure. Builds the human-readable "for X, Y, Z" constraint echo used in replies. */
export function describeConstraints(filters) {
  const parts = []
  if (filters.category) parts.push(filters.category)
  if (filters.maxPrice != null) parts.push(`under $${filters.maxPrice}`)
  if (filters.minPrice != null) parts.push(`over $${filters.minPrice}`)
  if (filters.maxDistanceMiles != null) parts.push(`within ${filters.maxDistanceMiles} mi`)
  if (filters.merchant) parts.push(filters.merchant)
  return parts.join(', ')
}

// Common empty-result reasons get a plain template, no model call — per the plan, "even
// then templates are tried first for the common empty-result reasons (no results in
// radius/price band/hours)".
const EMPTY_RESULT_TEMPLATES = {
  radius: (c) => `nothing within range for ${c} right now — want me to widen the search?`,
  price: (c) => `nothing that cheap for ${c} right now — want to see what's close instead?`,
  hours: (c) => `nothing open for ${c} right now — try again a bit later?`,
  generic: (c) => `nothing matching ${c} right now — try a different spot or category?`,
}

/**
 * Model composition, used only for the specific empty-result-with-unusual-reason case (not
 * a radius/price/hours miss, which the templates above already cover) — per the plan.
 */
async function composeUnusualEmptyResultReply(message) {
  const result = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    messages: [
      {
        role: 'user',
        content: `A user texted a deals-finder bot: ${JSON.stringify(message)}. We found zero matching deals, and it's not a simple radius/price/hours miss. Write ONE short, casual, lowercase text reply (under 25 words) explaining we didn't find anything and inviting them to try something else. No emoji, no markdown fences — just the reply text.`,
      },
    ],
  })
  const textBlock = result.content.find((b) => b.type === 'text')
  return textBlock?.text?.trim() || 'nothing matching that right now — try a different spot or category?'
}

function emptyResultReply(filters, constraints) {
  if (filters.maxDistanceMiles != null) return EMPTY_RESULT_TEMPLATES.radius(constraints)
  if (filters.maxPrice != null || filters.minPrice != null) return EMPTY_RESULT_TEMPLATES.price(constraints)
  if (filters.timeWindow) return EMPTY_RESULT_TEMPLATES.hours(constraints)
  return null // "unusual reason" — no template fits, caller falls through to model composition
}

/**
 * message: inbound text. profile/timezone/lastOutboundText: passed straight through to
 * intentExtraction.js. account: only used for engagementScoring.js's radius pass-through
 * parameter. Returns an AssistantTurn ({text, deals, quickReplies}) ready for sendRcsTurn.
 */
export async function handleOnDemandRequest({ message, profile, timezone, lastOutboundText, account }) {
  const filters = await extractIntent({ message, profile, timezone, lastOutboundText })

  if (filters.needsClarification) {
    return { text: filters.clarifyingQuestion || 'what are you in the mood for?', deals: [], quickReplies: [] }
  }

  const deals = await fetchDeals()
  const filtered = applyIntentFilters(deals, filters)
  const scored = scoreCandidates({ deals: filtered, profile, archetype: ARCHETYPES.VALUE, account })
  const constraints = describeConstraints(filters)

  if (scored.length === 0) {
    const constraintsOrFallback = constraints || 'that'
    let text = emptyResultReply(filters, constraintsOrFallback)
    if (!text) {
      try {
        text = await composeUnusualEmptyResultReply(message)
      } catch (err) {
        console.error('[onDemandRetrieval] empty-result composition failed, using generic template:', err.message)
        text = EMPTY_RESULT_TEMPLATES.generic(constraintsOrFallback)
      }
    }
    return { text, deals: [], quickReplies: [] }
  }

  const top = scored.slice(0, 2).map((s) => s.deal)

  if (top.length === 1) {
    // Single result: route through A6's template library so this reads like the rest of
    // Coop's voice, then prefix the interpreted constraints for correctability (echoing
    // "Thai, under $20, within 2 miles" back, per the plan's explicit requirement).
    const { turn } = renderEngagementTurn({
      archetype: ARCHETYPES.VALUE,
      deal: top[0],
      seed: `${account.id}:${Date.now()}`,
      lastTemplateId: null,
    })
    return { text: constraints ? `for ${constraints} — ${turn.text}` : turn.text, deals: top, quickReplies: [] }
  }

  // Two results: A6's templates are written for a single-deal turn (they name one
  // merchant), so a 2-card reply uses a plain constraint-echoing intro instead — the deal
  // cards themselves still render via the shared rcs/render.js carousel path either way.
  const intro = constraints ? `found these for ${constraints}:` : 'found a couple for you:'
  return { text: intro, deals: top, quickReplies: [] }
}
