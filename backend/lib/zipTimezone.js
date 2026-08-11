// Deterministic US zip-code -> IANA timezone lookup, per the build plan's guardrail #1
// resolution: no coordinates, no external geocoding service — a plain static data module
// keyed on the zip's 3-digit prefix, which is "sufficient granularity" for quiet-hours
// enforcement (Story A2). Two-stage: zip3 -> state (USPS's well-documented ZIP-prefix-to-
// state ranges), then state -> a single primary IANA timezone.
//
// Known, deliberate imprecision (flagging honestly, matching this codebase's convention
// elsewhere — see redact.js, merchants table comment): several states straddle two
// timezones (FL panhandle, west TX/El Paso, western NE/SD/ND/KS, MI's western UP, IN,
// KY). Each of those is collapsed to its dominant/most-populous zone rather than modeled
// at finer granularity. Worst case this makes quiet-hours enforcement off by one hour for
// zip codes in a state's minority timezone pocket — still strictly better than no
// timezone data at all (the pre-A0 state), and a `zip_code`-based fix-up table can be
// layered on top later without changing this module's shape.

// [minPrefix, maxPrefix, stateCode] — first match wins. Ranges per the standard USPS
// ZIP3-to-state table; not exhaustive of every U.S. territory (Puerto Rico, Guam, etc. —
// out of scope, Coop is a US-mainland-first product per the rest of the codebase).
const ZIP3_STATE_RANGES = [
  [10, 27, 'MA'],
  [28, 29, 'RI'],
  [30, 38, 'NH'],
  [39, 49, 'ME'],
  [50, 59, 'VT'],
  [60, 69, 'CT'],
  [70, 89, 'NJ'],
  [100, 149, 'NY'],
  [150, 196, 'PA'],
  [197, 199, 'DE'],
  [200, 205, 'DC'],
  [206, 219, 'MD'],
  [220, 246, 'VA'],
  [247, 268, 'WV'],
  [270, 289, 'NC'],
  [290, 299, 'SC'],
  [300, 319, 'GA'],
  [320, 349, 'FL'],
  [350, 369, 'AL'],
  [370, 385, 'TN'],
  [386, 397, 'MS'],
  [398, 399, 'GA'],
  [400, 427, 'KY'],
  [430, 459, 'OH'],
  [460, 479, 'IN'],
  [480, 499, 'MI'],
  [500, 528, 'IA'],
  [530, 549, 'WI'],
  [550, 567, 'MN'],
  [570, 577, 'SD'],
  [580, 588, 'ND'],
  [590, 599, 'MT'],
  [600, 629, 'IL'],
  [630, 658, 'MO'],
  [660, 679, 'KS'],
  [680, 693, 'NE'],
  [700, 714, 'LA'],
  [716, 729, 'AR'],
  [730, 749, 'OK'],
  [750, 799, 'TX'],
  [800, 816, 'CO'],
  [820, 831, 'WY'],
  [832, 838, 'ID'],
  [840, 847, 'UT'],
  [850, 865, 'AZ'],
  [870, 884, 'NM'],
  [889, 898, 'NV'],
  [900, 961, 'CA'],
  [967, 968, 'HI'],
  [970, 979, 'OR'],
  [980, 994, 'WA'],
  [995, 999, 'AK'],
]

const STATE_TIMEZONE = {
  MA: 'America/New_York',
  RI: 'America/New_York',
  NH: 'America/New_York',
  ME: 'America/New_York',
  VT: 'America/New_York',
  CT: 'America/New_York',
  NJ: 'America/New_York',
  NY: 'America/New_York',
  PA: 'America/New_York',
  DE: 'America/New_York',
  DC: 'America/New_York',
  MD: 'America/New_York',
  VA: 'America/New_York',
  WV: 'America/New_York',
  NC: 'America/New_York',
  SC: 'America/New_York',
  GA: 'America/New_York',
  FL: 'America/New_York',
  OH: 'America/New_York',
  IN: 'America/New_York',
  MI: 'America/New_York',
  KY: 'America/New_York',
  AL: 'America/Chicago',
  TN: 'America/Chicago',
  MS: 'America/Chicago',
  IL: 'America/Chicago',
  WI: 'America/Chicago',
  MN: 'America/Chicago',
  IA: 'America/Chicago',
  MO: 'America/Chicago',
  AR: 'America/Chicago',
  LA: 'America/Chicago',
  OK: 'America/Chicago',
  KS: 'America/Chicago',
  NE: 'America/Chicago',
  SD: 'America/Chicago',
  ND: 'America/Chicago',
  TX: 'America/Chicago',
  CO: 'America/Denver',
  WY: 'America/Denver',
  UT: 'America/Denver',
  NM: 'America/Denver',
  MT: 'America/Denver',
  ID: 'America/Denver',
  AZ: 'America/Phoenix', // no DST — deliberately its own zone, not folded into Denver
  CA: 'America/Los_Angeles',
  NV: 'America/Los_Angeles',
  OR: 'America/Los_Angeles',
  WA: 'America/Los_Angeles',
  AK: 'America/Anchorage',
  HI: 'Pacific/Honolulu',
}

function stateForZip(zip5) {
  const n3 = Number(zip5.slice(0, 3))
  for (const [min, max, state] of ZIP3_STATE_RANGES) {
    if (n3 >= min && n3 <= max) return state
  }
  return null
}

/**
 * Returns an IANA timezone string for a US zip code, or null if the zip is malformed or
 * falls outside the known ranges. Pure, synchronous, no I/O — safe to call at approval
 * time (lib/accounts.js) and in any suppression check (lib/engagementSuppression.js).
 */
export function timezoneForZip(zip) {
  const zip5 = String(zip || '').match(/^\d{5}/)?.[0]
  if (!zip5) return null
  const state = stateForZip(zip5)
  if (!state) return null
  return STATE_TIMEZONE[state] || null
}
