// Story B2 — regex/positional line-item extraction, stage 5 of the screenshot pipeline.
// Scoped to stage 5 ONLY, per the plan — does not touch merchant identification (stage 4,
// merchantDictionary.js) or category mapping. Tried before paying for a model-based item
// extraction call (screenshotParser.js's extractItemsOnly, on a dictionary-hit screenshot);
// if it recovers a plausible, internally-consistent item set, that model call is skipped
// entirely for that screenshot. Falls through to the existing model path unchanged
// otherwise — this module is a pure, additive optimization, never the sole path.
//
// Prerequisite: needs per-word bounding boxes, which ocr.js did not return until this same
// story's small change to it (requesting `{ blocks: true }` output — see ocr.js's own
// comment). Operates on ocr.js#extractText's `lines` output: Tesseract already groups
// words into lines for us, which is a more reliable "same receipt row" signal than
// re-clustering from raw word y-coordinates would be.
//
// Honest scope: this is a same-line, trailing-price heuristic, not true multi-column
// layout detection. It does NOT handle: item names that wrap across two OCR lines, receipts
// laid out in multiple visual columns, or quantity multipliers (e.g. "2x Latte  $9.00" is
// read as one $9.00 item, not resolved to $4.50 each) — flagging this plainly rather than
// overclaiming precision, matching this codebase's established commenting convention
// (redact.js, engagementScoring.js's isWithinRadius).

// A trailing price token at the end of a line — the same numeric shape redact.js's CARD_RE
// deliberately avoids colliding with (a receipt price is 1-3 digits before the decimal;
// redact.js's card-number pattern requires 13+ consecutive digits or 4-digit groups, so
// there's no overlap in practice).
const TRAILING_PRICE_RE = /\$?\s*(\d{1,3}(?:,\d{3})*\.\d{2})\s*$/
const STANDALONE_PRICE_WORD_RE = /^\$?\d{1,3}(?:,\d{3})*\.\d{2}$/

// Lines that are receipt metadata, not menu items — excluded from candidate item lines
// entirely, whether or not they happen to end in a price-shaped number (subtotal/tax/total
// all do).
const STOPLIST_RE =
  /\b(subtotal|sub[- ]total|tax|total|tip|gratuity|delivery( fee)?|service fee|fees?|discount|promo(tion)?|coupon|balance|change due|amount (due|paid)|cash|credit|debit|card ending|order\s*#|order number|confirmation|date|time|table|server|thank you|visit again|receipt|estimated|surcharge)\b/i

const MIN_ITEM_NAME_LENGTH = 2
// Sanity bound — real receipts don't have more line items than this; a regex pass that
// "finds" more than this on a single screenshot is more likely mis-parsing UI chrome than
// reading a real long order, so treat it as not plausible rather than trusting it blindly.
const MAX_PLAUSIBLE_ITEMS = 25
// Fraction the sum of extracted item prices is allowed to exceed the receipt's own
// total/subtotal line before the extraction is considered inconsistent and discarded (tax
// isn't included in the sum, so a small allowance above 1.0 is expected even on a fully
// correct extraction).
const TOTAL_TOLERANCE_FACTOR = 1.05

function stripLeadingQuantity(name) {
  return name.replace(/^\s*\d+\s*[xX]\s*/, '').trim()
}

/**
 * Pure. Given ocr.js#extractText's `lines` output, returns { items: string[] } if a
 * plausible, internally-consistent item set was found, or null if the regex pass isn't
 * confident enough — in which case the caller (screenshotParser.js) falls through to the
 * existing model-based extraction unchanged.
 */
export function extractLineItems(lines) {
  if (!lines || lines.length === 0) return null

  const items = []
  let totalLinePrice = null

  for (const line of lines) {
    const text = (line.text || '').trim()
    if (!text) continue
    if (STOPLIST_RE.test(text)) {
      // A total/subtotal line doesn't become an item, but its price is captured for the
      // internal-consistency check below, when this is specifically the total/grand-total
      // line (not tax/tip, which shouldn't bound the item sum the same way).
      if (/\btotal\b/i.test(text) && !/subtotal|sub[- ]total/i.test(text)) {
        const m = TRAILING_PRICE_RE.exec(text)
        if (m) totalLinePrice = Number(m[1].replace(/,/g, ''))
      }
      continue
    }

    // Positional pairing: prefer the rightmost word on the line that is itself
    // price-shaped (using each word's own bbox.x0 to confirm right-to-left order), falling
    // back to a plain trailing-price match on the line's full text if word-level bboxes
    // aren't present for some reason (defensive — ocr.js always provides them now, but this
    // keeps the function tolerant of a hand-built fixture that doesn't).
    let priceWord = null
    if (line.words && line.words.length > 0) {
      const priceWords = line.words.filter((w) => STANDALONE_PRICE_WORD_RE.test((w.text || '').trim()))
      if (priceWords.length > 0) {
        priceWord = priceWords.reduce((rightmost, w) => ((w.bbox?.x0 ?? 0) > (rightmost.bbox?.x0 ?? 0) ? w : rightmost))
      }
    }

    let priceValue
    let itemName
    if (priceWord) {
      priceValue = Number(priceWord.text.replace(/[$,]/g, ''))
      const idx = text.lastIndexOf(priceWord.text)
      itemName = idx >= 0 ? text.slice(0, idx) : text.replace(TRAILING_PRICE_RE, '')
    } else {
      const m = TRAILING_PRICE_RE.exec(text)
      if (!m) continue // no price on this line at all — not a candidate item line
      priceValue = Number(m[1].replace(/,/g, ''))
      itemName = text.slice(0, m.index)
    }

    itemName = stripLeadingQuantity(itemName.replace(/\$?\s*$/, '').trim())
    if (itemName.length < MIN_ITEM_NAME_LENGTH || !/[a-zA-Z]/.test(itemName)) continue

    items.push({ name: itemName, price: priceValue })
  }

  if (items.length === 0 || items.length > MAX_PLAUSIBLE_ITEMS) return null

  if (totalLinePrice != null) {
    const sum = items.reduce((s, i) => s + i.price, 0)
    if (sum > totalLinePrice * TOTAL_TOLERANCE_FACTOR) {
      // Internally inconsistent — the regex pass likely mis-split something. Fall through
      // to the model path rather than returning a plausible-looking but wrong item list.
      return null
    }
  }

  return { items: items.map((i) => i.name) }
}
