import { supabase } from './supabase.js'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Recreates the mock data's per-status endsLabel phrasing from a real
// timestamp, so the frontend components built against that shape don't need
// to change just because the data source did.
function formatEndsLabel(status, endsAt) {
  if (!endsAt) return null
  const d = new Date(endsAt)
  if (status === 'endingToday') {
    // Pinned to a fixed zone rather than the server's local time, which is
    // an environment artifact (differs between local dev and Render) and
    // produced a genuinely wrong-looking time before this fix.
    const time = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Los_Angeles',
    })
    return `Ends tonight at ${time}`
  }
  if (status === 'expiring') return `Ends ${WEEKDAYS[d.getUTCDay()]}`
  const monthDay = `${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}`
  if (status === 'used') return `Redeemed ${monthDay}`
  if (status === 'expired') return `Ended ${monthDay}`
  return `Ends ${monthDay}`
}

// Shared by routes/deals.js (HTTP) and routes/rcs.js (inbound text) — both
// need the same merchant-joined, frontend-shaped deal list. Previously
// duplicated only in routes/deals.js; routes/rcs.js's matchDeals() call was
// left calling the old single-arg mock-array signature and never updated,
// which meant it would throw on any inbound message that reached it.
export async function fetchDeals() {
  const { data, error } = await supabase
    .from('deals')
    .select(
      'id, offer, savings_amount, original_price, code, status, ends_at, merchants(name, initials, distance_label, first_visit_at, visit_count)',
    )
    .order('created_at', { ascending: true })

  if (error) throw error

  return data.map((row) => ({
    id: row.id,
    merchant: {
      name: row.merchants.name,
      initials: row.merchants.initials,
      visitCount: row.merchants.visit_count,
      firstVisit: MONTHS[new Date(row.merchants.first_visit_at).getUTCMonth()],
      distance: row.merchants.distance_label,
    },
    offer: row.offer,
    savingsAmount: Number(row.savings_amount),
    originalPrice: row.original_price != null ? Number(row.original_price) : null,
    code: row.code,
    status: row.status,
    endsLabel: formatEndsLabel(row.status, row.ends_at),
  }))
}
