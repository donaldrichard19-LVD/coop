import { supabase } from './supabase.js'

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Stage 4 (merchant identification) + stage 7 (category mapping) of the
// screenshot pipeline: deterministic lookup against OCR text, tried before
// any model call. Word-boundary regex rather than a plain substring check,
// so a short match string (e.g. "subway") can't false-positive inside an
// unrelated longer word.
//
// Deliberately tried regardless of overall OCR confidence — a merchant's
// name/header text is usually large, bold, and high-contrast, so it tends
// to survive OCR noise even when the rest of a receipt doesn't. Worth
// checking before ever paying for the expensive image-based fallback.
export async function matchMerchant(ocrText) {
  const { data, error } = await supabase.from('merchant_dictionary').select('name, category, match_strings')
  if (error) {
    console.error('[merchantDictionary] lookup failed:', error.message)
    return null
  }

  const haystack = ocrText.toLowerCase()
  for (const row of data) {
    for (const needle of row.match_strings) {
      const pattern = new RegExp(`\\b${escapeRegExp(needle.toLowerCase())}\\b`)
      if (pattern.test(haystack)) {
        return { name: row.name, category: row.category }
      }
    }
  }
  return null
}

// The confidence gate's payoff, per the guidance doc: a confirmed
// model-guessed merchant gets written back here so the next screenshot from
// the same place resolves at the dictionary's zero-token tier instead of
// paying for a model call again. Match string is the merchant's own
// lowercased name — same shape matchMerchant() already expects, and correct
// by construction for any receipt that prints the business name in its own
// header, which is the common case dictionary hits are built around.
export async function confirmMerchant(name, category) {
  const matchString = name.toLowerCase()
  const { data: existing, error: selectError } = await supabase
    .from('merchant_dictionary')
    .select('id, match_strings')
    .eq('name', name)
    .maybeSingle()
  if (selectError) {
    console.error('[merchantDictionary] confirm lookup failed:', selectError.message)
    return
  }

  if (existing) {
    if (existing.match_strings.includes(matchString)) return
    const { error } = await supabase
      .from('merchant_dictionary')
      .update({ match_strings: [...existing.match_strings, matchString] })
      .eq('id', existing.id)
    if (error) console.error('[merchantDictionary] confirm update failed:', error.message)
  } else {
    const { error } = await supabase
      .from('merchant_dictionary')
      .insert({ name, category, match_strings: [matchString] })
    if (error) console.error('[merchantDictionary] confirm insert failed:', error.message)
  }
}
