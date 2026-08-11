// In-memory phone -> last-sent-turn map, so an inbound QUICK_REPLY tap ("save_0",
// "save_1") can be resolved back to a real deal id. RCS quick-reply `id`s here are
// positional and static (see rcs/templates.js), not per-deal — variable substitution
// inside action.id isn't confirmed to work for twilio/card, so the lookup happens here
// instead. Swap this for a real store (Supabase, matching Calvin's convention) once
// this moves past the sketch stage — it does not survive a process restart as-is.

const lastTurnByPhone = new Map()

export function recordTurn(phone, deals, text = null) {
  lastTurnByPhone.set(phone, { deals, text, sentAt: Date.now() })
}

export function resolveQuickReplyId(phone, id) {
  const entry = lastTurnByPhone.get(phone)
  if (!entry) return null
  const match = /^save_(\d)$/.exec(id)
  if (!match) return null
  return entry.deals[Number(match[1])] ?? null
}

// Story A9 — the raw deals array from the last turn sent to this number, so a freeform
// "offer reply" ("I'll take the first one") can be resolved the same way a button tap's
// "save_0" already is above, without requiring an exact button-payload match. Returns null
// when there's no recorded turn (nothing to resolve against) — callers treat that as "no
// pending turn" per hasPendingTurn in lib/inboundClassifier.js.
export function getLastTurnDeals(phone) {
  return lastTurnByPhone.get(phone)?.deals ?? null
}

// Story A13 — the last-sent turn's text, so an anaphoric on-demand request ("anything
// cheaper than that") can pass the actual referenced message to intentExtraction.js. Same
// caveat as everything else in this file: in-memory, not race-proof, doesn't survive a
// restart.
export function getLastTurnText(phone) {
  return lastTurnByPhone.get(phone)?.text ?? null
}
