// Deal/merchant data itself now comes from the real backend (backend/routes/deals.js
// -> Supabase), not a mock array — see DealsContext.jsx. What's left here is flavor
// data that has no backing table yet: categoryBreakdown/savingsThisMonth need real
// redemption tracking to compute honestly (v1 non-goal per the product spec), and
// quickReplies are just example prompts, not derived from data at all.

export const categoryBreakdown = [
  { label: 'Coffee shops', amount: 22.4, percent: 48 },
  { label: 'Restaurants', amount: 16.75, percent: 36 },
  { label: 'Fast casual', amount: 7.49, percent: 16 },
]

export const savingsThisMonth = categoryBreakdown.reduce((sum, c) => sum + c.amount, 0)

export const quickReplies = [
  "What's good near me tonight?",
  'Anything expiring soon?',
  'Coffee deals only',
  'Show my top savings',
]

// naive keyword router for the mock assistant — takes the live deals array
// (fetched from the API) instead of reading a static import.
export function matchDeals(query, deals) {
  const q = query.toLowerCase()
  const notExpired = deals.filter((d) => d.status !== 'expired' && d.status !== 'used')

  if (q.includes('coffee')) {
    return notExpired.filter((d) => /coffee/i.test(d.merchant.name))
  }
  if (q.includes('expir')) {
    return notExpired.filter((d) => d.status === 'expiring' || d.status === 'endingToday')
  }
  if (q.includes('saving') || q.includes('top')) {
    return [...notExpired].sort((a, b) => b.savingsAmount - a.savingsAmount)
  }
  // default: "near me tonight" / anything else
  return notExpired
}
