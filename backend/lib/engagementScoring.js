import { archetypeProfile } from './engagementSlotPolicy.js'

// Story A4 — candidate retrieval + scoring for the scheduled-engagement pipeline. Reuses
// profileDealMatch.js's established shape (pure function, deterministic, ranked list) and
// scoring-tier idea rather than inventing a new style — profileDealMatch is EXACT/SIMILAR
// tiers off a preference profile; this is a weighted linear score off the same profile,
// biased by the current slot's archetype (see engagementSlotPolicy.js).
//
// Radius/geo — guardrail #1's resolved gap: `merchants` has no coordinates and real
// geocoding is out of scope for this pass (a separate, larger gap on the deal-inventory
// side). isWithinRadius() below is a clearly-commented permissive pass-through — every
// candidate passes — not a silent stub. When real merchant coordinates land, only this one
// function needs to change; every caller (this file, engagementSuppression.js) already
// treats "within radius" as a named check, not an inlined `true`.

const WEIGHTS = {
  categoryAffinity: 3,
  priceTierFit: 2,
  merchantFamiliarity: 2,
  dealStrength: 1,
}

// Story P2-4 — soft merchant-repetition penalty, additive to lib/engagementRepetition.js's
// existing hard exact-deal_id exclusion (that behavior is unchanged). A candidate whose
// merchant matches the account's most-recently-sent deal's merchant (see
// lib/engagementSend.js#lastSentMerchantName) gets scored DOWN by this amount rather than
// excluded outright — it can still be picked if nothing better is available (e.g. a
// two-merchant-thin local market on a given day), unlike the hard exclusion. Sized relative
// to WEIGHTS' 0..1-normalized-per-factor scale: a full-strength candidate scores at most
// ~3+2+2+1=8 today, so 1.5 sits below the single highest-weighted factor (categoryAffinity's
// 3) but above the lowest (dealStrength's 1) — enough to flip a close ranking without acting
// as an effective hard exclusion, which is exactly what the existing exact-deal_id exclusion
// already owns.
export const RECENT_MERCHANT_PENALTY = 1.5

/**
 * Permissive pass-through, per guardrail #1 — merchants has no coordinates today (only a
 * free-text distance_label), so there is no real distance to check against a radius. Always
 * returns true. Kept as a named, separately-callable function (not inlined) specifically so
 * this is a single, obvious place to swap in a real haversine check once merchant geocoding
 * exists — see the merchants table's own "single global value for now" comment for the
 * matching precedent on this codebase being upfront about the same kind of gap.
 */
export function isWithinRadius(_deal, _account, _radiusOverride) {
  return true
}

function isValid(deal) {
  return deal.status !== 'expired' && deal.status !== 'used'
}

// Weighted linear score, each term normalized to roughly [0, 1] before its weight is
// applied, so WEIGHTS above is legible as "how much this factor matters" rather than
// tangled up with each factor's own arbitrary scale.
function scoreDeal(deal, profile, archetype, recentMerchantName) {
  const profileCategories = profile.topCategories || []
  const categoryRank = profileCategories.indexOf(deal.category)
  // 1.0 for the top category, decaying toward 0 the further down the ranked list; 0 if the
  // category isn't in the profile at all.
  const categoryAffinity = categoryRank === -1 ? 0 : 1 / (categoryRank + 1)

  const isFamiliarMerchant = profile.merchantNames?.has(deal.merchant?.name)
  const { noveltyDirection, priceBias } = archetypeProfile(archetype)
  // Direction depends on slot archetype, per the plan: a "value" slot wants familiar
  // merchants (reduces the risk/decision-cost of a proactive nudge); a "discovery" slot
  // wants the opposite, on purpose, so it doesn't just re-recommend what the value slot
  // already covers; "weekend" is neutral on this axis (social/occasion-driven, not
  // familiarity-driven).
  let merchantFamiliarity = 0.5
  if (noveltyDirection === 'familiar') merchantFamiliarity = isFamiliarMerchant ? 1 : 0
  else if (noveltyDirection === 'novel') merchantFamiliarity = isFamiliarMerchant ? 0 : 1

  // Price-tier fit: a rough proxy since deals don't carry a first-class "price tier" field
  // — original_price stands in for it. "low" bias (value slot) rewards cheaper deals;
  // "high" bias (weekend slot) rewards deals with a higher ticket size; "neutral"
  // (discovery slot) doesn't weigh price at all.
  const price = deal.originalPrice ?? deal.savingsAmount ?? 0
  let priceTierFit = 0.5
  if (priceBias === 'low') priceTierFit = price > 0 ? Math.max(0, 1 - price / 40) : 0.5
  else if (priceBias === 'high') priceTierFit = price > 0 ? Math.min(1, price / 40) : 0.5

  // Deal strength: bigger absolute savings scores higher, capped so one outlier deal
  // doesn't dominate every other factor.
  const dealStrength = Math.min(1, (deal.savingsAmount || 0) / 15)

  let total =
    WEIGHTS.categoryAffinity * categoryAffinity +
    WEIGHTS.priceTierFit * priceTierFit +
    WEIGHTS.merchantFamiliarity * merchantFamiliarity +
    WEIGHTS.dealStrength * dealStrength

  // Story P2-4 — soft merchant-repetition penalty, applied after the weighted sum so it
  // reads as a distinct adjustment rather than being folded into any one WEIGHTS factor.
  const recentMerchantPenaltyApplied = !!(recentMerchantName && deal.merchant?.name === recentMerchantName)
  if (recentMerchantPenaltyApplied) total -= RECENT_MERCHANT_PENALTY

  return {
    total,
    breakdown: { categoryAffinity, priceTierFit, merchantFamiliarity, dealStrength, recentMerchantPenaltyApplied },
  }
}

/**
 * deals: lib/deals.js#fetchDeals shape. profile: lib/preferenceProfile.js#getPreferenceProfile
 * shape. archetype: one of engagementSlotPolicy.js's ARCHETYPES. account: the accounts row
 * (only used for radius today, which is a pass-through — see isWithinRadius).
 * recentMerchantName (Story P2-4, optional): the account's most-recently-sent deal's
 * merchant name (lib/engagementSend.js#lastSentMerchantName) — when a candidate's merchant
 * matches, it takes the RECENT_MERCHANT_PENALTY soft penalty above. Omitting it (undefined)
 * simply applies no penalty, so existing callers/tests that don't pass it are unaffected.
 *
 * Returns every valid, in-radius candidate sorted best-first, each annotated with its score
 * and breakdown — loggable/explainable per send, per the plan's requirement, not just a bare
 * ranked list.
 */
export function scoreCandidates({ deals, profile, archetype, account, radiusOverride, recentMerchantName }) {
  const candidates = []
  for (const deal of deals) {
    if (!isValid(deal)) continue
    if (!isWithinRadius(deal, account, radiusOverride)) continue
    const { total, breakdown } = scoreDeal(deal, profile, archetype, recentMerchantName)
    candidates.push({ deal, score: total, breakdown })
  }
  candidates.sort((a, b) => b.score - a.score)
  return candidates
}

/**
 * Story P2-5 — control-group candidate scoring: a fixed, generic selection rule (deal
 * strength only — bigger absolute savings ranks higher) with NO profile/archetype weighting
 * at all, so scoring is the only isolated variable between a treatment and control send
 * (suppression, slot-policy structure, repetition guard, and templates are identical for
 * both — see engagementScheduler.js). Chose plain deal-strength ranking over a rotating-
 * inventory rule because it needs no extra state beyond what scoreCandidates already
 * threads through (deal, account, radiusOverride) and stays directly explainable in the
 * same "score + breakdown" shape every other candidate list uses. The soft merchant-
 * repetition penalty (RECENT_MERCHANT_PENALTY) still applies here too — Story P2-4's
 * repetition tuning is independent of the treatment/control split, not something Story P2-5
 * is scoped to exclude.
 */
export function scoreCandidatesControlGroup({ deals, account, radiusOverride, recentMerchantName }) {
  const candidates = []
  for (const deal of deals) {
    if (!isValid(deal)) continue
    if (!isWithinRadius(deal, account, radiusOverride)) continue

    let total = Math.min(1, (deal.savingsAmount || 0) / 15) // same dealStrength normalization as scoreDeal
    const recentMerchantPenaltyApplied = !!(recentMerchantName && deal.merchant?.name === recentMerchantName)
    if (recentMerchantPenaltyApplied) total -= RECENT_MERCHANT_PENALTY

    candidates.push({ deal, score: total, breakdown: { dealStrength: total, recentMerchantPenaltyApplied } })
  }
  candidates.sort((a, b) => b.score - a.score)
  return candidates
}
