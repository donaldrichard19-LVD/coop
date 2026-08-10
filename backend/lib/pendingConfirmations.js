// In-memory phone -> pending merchant-guess map, so an inbound confirm_yes/
// confirm_no tap can be resolved back to what was actually guessed. Same
// shape and same caveat as session.js's lastTurnByPhone: not race-proof,
// doesn't survive a process restart — fine at Coop's current scale, same
// convention already established there.

const pendingByPhone = new Map()

export function setPendingConfirmation(phone, { merchantName, category }) {
  pendingByPhone.set(phone, { merchantName, category })
}

export function resolvePendingConfirmation(phone) {
  const entry = pendingByPhone.get(phone)
  pendingByPhone.delete(phone)
  return entry ?? null
}
