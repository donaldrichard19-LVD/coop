import { anthropic } from './anthropic.js'
import { supabase } from './supabase.js'

function normalizeKey(raw) {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

const BATCH_PROMPT = `You are normalizing a batch of raw item names extracted from food/order receipts into canonical products.

For each input string, return an object with:
- "raw": the exact input string, unchanged (used to match results back to inputs)
- "canonical": the most general accurate product name, or null if you cannot determine it confidently
- "category": a general category (e.g. "coffee", "bakery", "produce"), or null if unclear
- "flagged": true if this string could plausibly refer to two different products, false otherwise

Rules:
1. Return null for canonical/category rather than guessing when uncertain. A null costs one correction later; a confident wrong answer silently corrupts this cache for every future screenshot with the same item.
2. Expand abbreviations only when unambiguous in a food/grocery context.
3. Never infer a brand that is not present in the string.
4. Preserve size and quantity exactly as written — do not convert units.
5. Return the most general accurate product name, not an over-specific one — matching happens at category/product level, not SKU level.
6. Set flagged: true rather than silently picking one interpretation when a string could plausibly be two different products.

Return ONLY a JSON array, one object per input, in the same order as the input list. No markdown fences, no prose, nothing else.`

function parseJsonResponse(text) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
  return JSON.parse(cleaned)
}

// Batches every unseen item within a single screenshot into one call — not
// the full cross-upload 20-40 item batch the design doc describes, since
// that needs an async/queued architecture (accumulate items across many
// users' uploads before processing any of them) that doesn't fit a
// real-time SMS reply, and isn't worth building at Coop's current
// near-zero volume. Still gets the core benefit: the batch's shared
// instruction cost is spread across every item in one receipt instead of
// paid per item, and this uses the smallest model tier that can do this
// bounded, well-specified task — not the same tier as full-screenshot
// parsing, which is a much less constrained job.
async function normalizeBatch(rawStrings) {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `${BATCH_PROMPT}\n\nItems:\n${rawStrings.map((s, i) => `${i + 1}. ${JSON.stringify(s)}`).join('\n')}`,
      },
    ],
  })
  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock) throw new Error('No text response from Claude')
  return parseJsonResponse(textBlock.text)
}

// Stage 6: cache first, model only on miss. Every result — including nulls
// and flags — gets written back, so an unresolvable string is only ever
// attempted (and paid for) once, never re-attempted on a future occurrence
// of the exact same raw text.
export async function normalizeItems(rawNames) {
  if (!rawNames || rawNames.length === 0) return []

  const keys = rawNames.map(normalizeKey)
  const { data: cachedRows, error: lookupError } = await supabase
    .from('item_normalization_cache')
    .select('raw_text, canonical_name, category')
    .in('raw_text', keys)
  if (lookupError) console.error('[itemNormalization] cache lookup failed:', lookupError.message)

  const cacheByKey = new Map((cachedRows || []).map((row) => [row.raw_text, row]))
  const misses = [...new Set(keys.filter((k) => !cacheByKey.has(k)))]

  if (misses.length > 0) {
    console.log(`[itemNormalization] ${misses.length} cache miss(es), ${keys.length - misses.length} hit(s)`)
    try {
      const results = await normalizeBatch(misses)
      const rows = results.map((r) => ({
        raw_text: normalizeKey(r.raw ?? ''),
        canonical_name: r.canonical || null,
        category: r.category || null,
        flagged: !!r.flagged,
      }))
      const { error: writeError } = await supabase
        .from('item_normalization_cache')
        .upsert(rows, { onConflict: 'raw_text' })
      if (writeError) console.error('[itemNormalization] cache write-back failed:', writeError.message)
      for (const row of rows) cacheByKey.set(row.raw_text, row)
    } catch (err) {
      console.error('[itemNormalization] batch normalization failed:', err.message)
      // Leave misses uncached on failure — they'll be retried next time,
      // not silently poisoned with a null that was never actually decided.
    }
  } else {
    console.log(`[itemNormalization] all ${keys.length} item(s) served from cache — 0 tokens`)
  }

  return rawNames.map((raw, i) => {
    const hit = cacheByKey.get(keys[i])
    return { name: hit?.canonical_name || raw, category: hit?.category || null }
  })
}
