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
