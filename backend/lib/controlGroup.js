import crypto from 'node:crypto'

// Story P2-5 — 10% control group. Assignment is a pure, stable hash of account_id, NOT a
// live random roll on each evaluation — the whole point being that re-checking this later
// for the same account always returns the same answer, which is what lets
// engagementSuppression.js#checkSuppression safely implement "assigned once" as "write it
// the first time engagement_preferences.is_control_group is still null" rather than needing
// a separate assignment-lock/transaction.
//
// Hash approach: MD5 the account_id (a uuid string), take the first 4 bytes as an unsigned
// 32-bit big-endian integer, mod 100. A bucket < CONTROL_GROUP_RATE (10) is control group.
// MD5 is used only for its fast, uniform bit distribution over arbitrary string input — not
// for any cryptographic property (this is deterministic bucketing, not a secret). Do not
// change this hash function/rate without a deliberate migration plan: changing it would
// silently reassign every already-assigned account on their next evaluation, which the
// current one-time-assignment design does not expect or handle.

const CONTROL_GROUP_RATE = 10 // percent

export function isControlGroupAccount(accountId) {
  const hash = crypto.createHash('md5').update(String(accountId)).digest()
  const bucket = hash.readUInt32BE(0) % 100
  return bucket < CONTROL_GROUP_RATE
}
