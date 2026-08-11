import { supabase } from './supabase.js'

// Stage 8 of the screenshot pipeline: pure aggregation over screenshot_uploads,
// no model call. Per the guidance doc's routing rule, a preference profile is
// counting and weighting, not a judgment call — deterministic code, same as
// screenshot_uploads' own comment says ("preference profile is deliberately
// not a separate materialized table — it's a query over this log").

const RECENCY_HALF_LIFE_DAYS = 30
const MIN_UPLOADS_FOR_PROFILE = 3

// Story P2-2 — minimum count of non-null-order_timestamp rows before the day-of-week
// histogram is considered to have "enough signal" for engagementScheduler.js to act on it
// (lib/engagementDayOptimization.js#resolveSendDays). Same magnitude as
// MIN_UPLOADS_FOR_PROFILE by default — a handful of dated orders is enough to suggest a
// pattern worth trying, without requiring a long history first.
const MIN_ORDER_TIMESTAMPS_FOR_DAY_SIGNAL = 3

function recencyWeight(createdAt) {
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86_400_000
  return Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS)
}

// merchant-level category and item-level category both feed the same
// category weighting, but an item category is a weaker signal (one order
// can span several item categories, only one of which is "the" merchant
// category) — half weight keeps a receipt's dominant category from being
// diluted by a couple of odd items on it.
const ITEM_CATEGORY_WEIGHT = 0.5

export async function getPreferenceProfile(accountId) {
  const { data, error } = await supabase
    .from('screenshot_uploads')
    .select('merchant_name, category, items, created_at, order_timestamp')
    .eq('account_id', accountId)
  if (error) throw error

  const categoryWeight = new Map()
  const merchantNames = new Set()
  // Story P2-2 — day-of-week histogram, index 0=Sunday..6=Saturday matching Date#getDay()
  // (order_timestamp is stored as an ISO instant, read back here via getUTCDay() to match
  // the UTC interpretation lib/orderTimestamp.js documents storing it as).
  const dayOfWeekWeight = new Array(7).fill(0)
  let orderTimestampCount = 0

  for (const row of data) {
    const weight = recencyWeight(row.created_at)

    if (row.category && row.category !== 'unknown') {
      categoryWeight.set(row.category, (categoryWeight.get(row.category) || 0) + weight)
    }
    for (const item of row.items || []) {
      if (item?.category) {
        categoryWeight.set(
          item.category,
          (categoryWeight.get(item.category) || 0) + weight * ITEM_CATEGORY_WEIGHT,
        )
      }
    }
    if (row.merchant_name) merchantNames.add(row.merchant_name)

    // Rows with a null order_timestamp are deliberately excluded from this signal
    // specifically (they still counted for category/merchant above) — upload time
    // (created_at) is not a reliable proxy for order day (a screenshot can be sent hours
    // or days after the order itself), so silently falling back to created_at here would
    // corrupt the day-of-week histogram rather than just weaken it. See
    // screenshot_uploads.order_timestamp's column comment for the same reasoning.
    if (row.order_timestamp) {
      const day = new Date(row.order_timestamp).getUTCDay()
      dayOfWeekWeight[day] += weight
      orderTimestampCount++
    }
  }

  const topCategories = [...categoryWeight.entries()].sort((a, b) => b[1] - a[1]).map(([category]) => category)

  return {
    uploadCount: data.length,
    isReady: data.length >= MIN_UPLOADS_FOR_PROFILE,
    merchantNames,
    topCategories,
    categoryWeight,
    dayOfWeekWeight,
    orderTimestampCount,
  }
}

export { MIN_UPLOADS_FOR_PROFILE, MIN_ORDER_TIMESTAMPS_FOR_DAY_SIGNAL }
