// status: 'active' | 'expiring' | 'endingToday' | 'used' | 'expired'
// (a separate `saved` boolean, tracked at runtime, layers the SAVED badge on top)

export const deals = [
  {
    id: 'd-bluebottle',
    merchant: { name: 'Blue Bottle Coffee', initials: 'BB', visitCount: 24, firstVisit: 'March', distance: '0.3 mi' },
    offer: 'Free drip coffee with any pastry purchase',
    savingsAmount: 4.2,
    originalPrice: null,
    code: null,
    status: 'expiring',
    endsLabel: 'Ends Sunday',
  },
  {
    id: 'd-chipotle',
    merchant: { name: 'Chipotle', initials: 'CH', visitCount: 18, firstVisit: 'January', distance: '0.6 mi' },
    offer: '$0 delivery fee on orders over $15',
    savingsAmount: 3.99,
    originalPrice: null,
    code: 'CHIP-ZERO-15',
    status: 'endingToday',
    endsLabel: 'Ends tonight at 10pm',
  },
  {
    id: 'd-panera',
    merchant: { name: 'Panera Bread', initials: 'PB', visitCount: 9, firstVisit: 'April', distance: '0.8 mi' },
    offer: 'Free pastry with any Sip Club drink',
    savingsAmount: 3.5,
    originalPrice: null,
    code: null,
    status: 'active',
    endsLabel: 'Ends Aug 31',
  },
  {
    id: 'd-tonys',
    merchant: { name: "Tony's Pizza Napoletana", initials: 'TP', visitCount: 6, firstVisit: 'May', distance: '1.1 mi' },
    offer: '15% off your next visit',
    savingsAmount: 6.75,
    originalPrice: 45.0,
    code: 'TONYS-REGULAR-15',
    status: 'expiring',
    endsLabel: 'Ends Friday',
  },
  {
    id: 'd-petes',
    merchant: { name: "Pete's Coffee", initials: 'PC', visitCount: 4, firstVisit: 'June', distance: '0.4 mi' },
    offer: '20% off any cold brew',
    savingsAmount: 1.1,
    originalPrice: 5.5,
    code: null,
    status: 'used',
    endsLabel: 'Redeemed Aug 2',
  },
  {
    id: 'd-lucky',
    merchant: { name: 'Lucky Dumpling House', initials: 'LD', visitCount: 3, firstVisit: 'June', distance: '1.4 mi' },
    offer: '$5 off orders over $25',
    savingsAmount: 5,
    originalPrice: null,
    code: 'LUCKY5',
    status: 'active',
    endsLabel: 'Ends Sep 10',
  },
  {
    id: 'd-ritual',
    merchant: { name: 'Ritual Coffee Roasters', initials: 'RC', visitCount: 7, firstVisit: 'February', distance: '0.5 mi' },
    offer: 'Buy one, get one drip coffee',
    savingsAmount: 3.75,
    originalPrice: null,
    code: null,
    status: 'expired',
    endsLabel: 'Ended Jul 28',
  },
]

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

// naive keyword router for the mock assistant
export function matchDeals(query) {
  const q = query.toLowerCase()
  const notExpired = deals.filter((d) => d.status !== 'expired')

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
