import { ENGAGEMENT_TEMPLATES } from './engagementTemplates.js'

// Story A6 — pure function: (archetype, deal, seed, lastTemplateId) -> AssistantTurn-
// shaped { text, deals, quickReplies }, same shape rcs/render.js's renderTurnAsRCS already
// knows how to turn into RCS messages, so a rendered engagement turn goes through the
// existing sendRcsTurn path unchanged (per guardrail #4). No network calls, no Twilio SDK —
// fully unit-testable, matching rcs/render.js's own convention.

function hashToIndex(key, mod) {
  let h = 0
  const s = String(key)
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  }
  return mod > 0 ? h % mod : 0
}

// No {distance} slot, deliberately — see engagementTemplates.js's header comment for why:
// merchants.distance_label is a single value shared across every account, so stating it as
// fact in an unprompted proactive text would be a specific, likely-wrong claim. None of the
// templates use it any more; fillSlots only fills the four slots that remain real per-deal
// data.
function fillSlots(text, deal) {
  return text
    .replaceAll('{merchant}', deal.merchant?.name ?? 'a spot near you')
    .replaceAll('{offer}', deal.offer ?? 'a deal')
    .replaceAll('{category}', deal.category ?? 'favorite')
    .replaceAll('{expiry}', deal.endsLabel ?? 'ends soon')
}

/**
 * Deterministic given the same inputs (reproducible/testable), but varies by seed — the
 * caller (engagementSend.js) passes something like `${accountId}:${dateKey}` so the same
 * account gets a different template on a different send day without any randomness or
 * hidden state. lastTemplateId (the account's most-recently-used template id, looked up
 * from engagement_sends) is excluded from the candidate pool first, satisfying "rotates
 * variants to avoid repeating the same phrasing twice in a row for the same account" —
 * unless the archetype only has one template defined, in which case there's nothing to
 * rotate to and the same one is reused.
 */
export function selectTemplate({ archetype, seed, lastTemplateId }) {
  const pool = ENGAGEMENT_TEMPLATES[archetype] || ENGAGEMENT_TEMPLATES.value
  const candidates = pool.length > 1 ? pool.filter((tmpl) => tmpl.id !== lastTemplateId) : pool
  const index = hashToIndex(seed, candidates.length)
  return candidates[index]
}

/**
 * Builds the full AssistantTurn for a scheduled-engagement send. `deal` is a single deal
 * object shaped like lib/deals.js#fetchDeals' output (same shape rcs/render.js already
 * expects). Returns { turn, templateId } — templateId is what engagementSend.js (A7)
 * writes to engagement_sends.template_id, closing the loop for the next call's
 * lastTemplateId lookup.
 */
export function renderEngagementTurn({ archetype, deal, seed, lastTemplateId }) {
  const template = selectTemplate({ archetype, seed, lastTemplateId })
  const text = fillSlots(template.text, deal)
  return {
    turn: { text, deals: [deal], quickReplies: [] },
    templateId: template.id,
  }
}
