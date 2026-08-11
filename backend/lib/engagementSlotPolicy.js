// Story A3 — pure rotation-table lookup, no I/O. Given a day-of-week (and which of the
// account's P0-fixed two weekly send slots this is — see engagementScheduler.js), returns
// the archetype that slot should aim for. Deterministic and reproducible: same inputs
// always produce the same archetype, which is what makes A4's scoring explainable
// ("this deal was picked because slot X wanted archetype Y") and A6's template selection
// possible without any hidden state.
//
// Early-week / midweek / late-week per the plan's own wording: value/weekday-lunch early,
// discovery/novel-merchant midweek, weekend/social/higher-price late week. P0 sends are
// fixed at Monday/Thursday (see engagementScheduler.js), so in practice Monday lands in
// the early-week bucket and Thursday in the midweek bucket today — the late-week
// (weekend/social) archetype is defined and ready for whenever per-user day optimization
// (P2) actually schedules a weekend-adjacent send.

export const ARCHETYPES = {
  VALUE: 'value',
  DISCOVERY: 'discovery',
  WEEKEND: 'weekend',
}

// 0 = Sunday ... 6 = Saturday, matching Date#getDay().
const DAY_BUCKET = {
  0: 'late', // Sunday
  1: 'early', // Monday
  2: 'early', // Tuesday
  3: 'mid', // Wednesday
  4: 'mid', // Thursday
  5: 'late', // Friday
  6: 'late', // Saturday
}

const BUCKET_ARCHETYPE = {
  early: ARCHETYPES.VALUE,
  mid: ARCHETYPES.DISCOVERY,
  late: ARCHETYPES.WEEKEND,
}

/**
 * dayOfWeek: 0-6 (Date#getDay() convention). Returns one of ARCHETYPES.
 */
export function archetypeForDay(dayOfWeek) {
  const bucket = DAY_BUCKET[dayOfWeek]
  return BUCKET_ARCHETYPE[bucket] || ARCHETYPES.VALUE
}

// Per-archetype scoring bias, consumed by engagementScoring.js (A4): which direction
// merchant familiarity/novelty should push the score, and whether higher price tolerance
// is rewarded. Kept alongside the rotation table since both describe the same "what does
// this slot want" concept — splitting them into separate files would just make them
// harder to keep in sync.
export const ARCHETYPE_PROFILE = {
  [ARCHETYPES.VALUE]: { noveltyDirection: 'familiar', priceBias: 'low', weekdayLunchLean: true },
  [ARCHETYPES.DISCOVERY]: { noveltyDirection: 'novel', priceBias: 'neutral', weekdayLunchLean: false },
  [ARCHETYPES.WEEKEND]: { noveltyDirection: 'neutral', priceBias: 'high', weekdayLunchLean: false },
}

export function archetypeProfile(archetype) {
  return ARCHETYPE_PROFILE[archetype] || ARCHETYPE_PROFILE[ARCHETYPES.VALUE]
}
