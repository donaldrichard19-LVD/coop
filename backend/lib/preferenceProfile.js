import { supabase } from './supabase.js'

// Stage 8 of the screenshot pipeline: pure aggregation over screenshot_uploads,
// no model call. Per the guidance doc's routing rule, a preference profile is
// counting and weighting, not a judgment call — deterministic code, same as
// screenshot_uploads' own comment says ("preference profile is deliberately
// not a separate materialized table — it's a query over this log").

const RECENCY_HALF_LIFE_DAYS = 30
const MIN_UPLOADS_FOR_PROFILE = 3

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
    .select('merchant_name, category, items, created_at')
    .eq('account_id', accountId)
  if (error) throw error

  const categoryWeight = new Map()
  const merchantNames = new Set()

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
  }

  const topCategories = [...categoryWeight.entries()].sort((a, b) => b[1] - a[1]).map(([category]) => category)

  return {
    uploadCount: data.length,
    isReady: data.length >= MIN_UPLOADS_FOR_PROFILE,
    merchantNames,
    topCategories,
    categoryWeight,
  }
}

export { MIN_UPLOADS_FOR_PROFILE }
