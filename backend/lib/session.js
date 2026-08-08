// In-memory phone -> last-sent-turn map, so an inbound QUICK_REPLY tap ("save_0",
// "save_1") can be resolved back to a real deal id. RCS quick-reply `id`s here are
// positional and static (see rcs/templates.js), not per-deal — variable substitution
// inside action.id isn't confirmed to work for twilio/card, so the lookup happens here
// instead. Swap this for a real store (Supabase, matching Calvin's convention) once
// this moves past the sketch stage — it does not survive a process restart as-is.

const lastTurnByPhone = new Map()

export function recordTurn(phone, deals) {
  lastTurnByPhone.set(phone, { deals, sentAt: Date.now() })
}

export function resolveQuickReplyId(phone, id) {
  const entry = lastTurnByPhone.get(phone)
  if (!entry) return null
  const match = /^save_(\d)$/.exec(id)
  if (!match) return null
  return entry.deals[Number(match[1])] ?? null
}
