// Stage 9 of the screenshot pipeline: filtered retrieval + deterministic
// scoring against a preference profile, not a model call — per the routing
// rule, "which of these existing deals fits this profile" has one
// defensible answer given fixed inputs, same reasoning stage 8 leans on.
//
// Two tiers, matching the acceptance criterion's own wording ("similar or
// exact goods"): EXACT is a deal at a merchant the profile has an actual
// screenshot from; SIMILAR is a deal whose merchant category overlaps one
// of the profile's top categories, at a merchant the profile hasn't
// necessarily visited. Exact always outranks similar; ties break on
// savings amount, same as the web app's "top savings" sort.
const EXACT_MATCH_SCORE = 2
const SIMILAR_MATCH_SCORE = 1

export function matchDealsToProfile(deals, profile, { limit = 2 } = {}) {
  const notExpired = deals.filter((d) => d.status !== 'expired' && d.status !== 'used')

  const scored = []
  for (const deal of notExpired) {
    const isExact = profile.merchantNames.has(deal.merchant.name)
    const isSimilar = !isExact && deal.category && profile.topCategories.includes(deal.category)
    if (!isExact && !isSimilar) continue
    scored.push({ deal, score: isExact ? EXACT_MATCH_SCORE : SIMILAR_MATCH_SCORE })
  }

  scored.sort((a, b) => b.score - a.score || b.deal.savingsAmount - a.deal.savingsAmount)

  // Hard-capped at 2 regardless of caller's limit: renderTurnAsRCS throws on
  // turn.deals.length > 2 (Coop's carousel-size rule), so this must never
  // hand back more than that.
  return scored.slice(0, Math.min(limit, 2)).map((s) => s.deal)
}
