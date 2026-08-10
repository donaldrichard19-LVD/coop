import { anthropic } from './anthropic.js'
import { extractText } from './ocr.js'
import { matchMerchant } from './merchantDictionary.js'
import { redactPII } from './redact.js'
import { normalizeItems } from './itemNormalization.js'

// Below this OCR text length or confidence (0-100), treat OCR as having
// failed rather than trust garbled output — fall back to sending the image
// directly. No regex line-item extractor exists yet (a later pipeline
// stage), so this is the full extent of the fallback ladder for a
// dictionary miss: OCR text, or the raw image, never both.
const MIN_OCR_TEXT_LENGTH = 20
const MIN_OCR_CONFIDENCE = 40

const TEXT_PROMPT_HEADER = `Below is OCR-extracted text from a screenshot of a food/delivery order or receipt. OCR text can have misread characters, jumbled line order, or extra noise from app UI chrome (buttons, nav bars, status bar) — read past that and extract what you can.`

const IMAGE_PROMPT = `You are extracting structured data from a screenshot of a food/delivery order or receipt.`

// "items" is raw name strings only, not {name, category} — categorizing an
// item is itemNormalization.js's job now (stage 6+7), done once per unique
// raw string and cached, instead of re-guessed by every single screenshot
// that happens to mention the same item.
const SHARED_RULES = `
Return ONLY valid JSON in this exact shape — no markdown fences, no explanation, nothing else:
{"merchant": string|null, "category": string, "items": [string]}

Rules:
- "merchant" is the specific business name (e.g. "Blue Bottle Coffee"). Only set it when you can identify the specific business with real confidence — otherwise null.
- "category" is REQUIRED, always filled in even when merchant is null: a general type of place or cuisine (e.g. "mexican", "coffee", "dessert", "pizza", "sushi", "fast casual"). Never leave it blank — this is the fallback when the specific merchant isn't identifiable.
- "items" lists the individual food/drink items visible in the order, as raw strings exactly as they appear. Empty array if none are legible.
- If this doesn't look like a food/order screenshot at all, return {"merchant": null, "category": "unknown", "items": []}.`

// Used only after a dictionary hit — merchant and category are already
// known at zero tokens, so this prompt doesn't ask Claude to reason about
// either, just items. No regex extractor exists yet (that fully-zero-token
// version is a later pipeline stage), so this is still a model call, just
// a smaller one.
function itemsOnlyPrompt(merchantName) {
  return `Below is OCR-extracted text from a screenshot of an order at ${merchantName}. OCR text can have misread characters, jumbled line order, or extra noise from app UI chrome — read past that.

Return ONLY valid JSON in this exact shape — no markdown fences, no explanation, nothing else:
{"items": [string]}

List the individual food/drink items visible in the order, as raw strings exactly as they appear. Empty array if none are legible.`
}

function parseJsonResponse(text) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
  return JSON.parse(cleaned)
}

async function downloadMedia(mediaUrl) {
  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
  const res = await fetch(mediaUrl, { headers: { Authorization: `Basic ${auth}` } })
  if (!res.ok) throw new Error(`Failed to download media: HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

// Common path: OCR text only, no image tokens at all — roughly 900-1,400
// tokens per call versus 4,000-6,000+ for the raw image, per the same
// tradeoff a full-resolution screenshot vs. its OCR text always has.
async function extractFromText(text) {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: `${TEXT_PROMPT_HEADER}${SHARED_RULES}\n\nOCR text:\n"""\n${text}\n"""` }],
  })
  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock) throw new Error('No text response from Claude')
  return parseJsonResponse(textBlock.text)
}

// Dictionary-hit path: merchant + category already resolved at zero tokens,
// so this call only has to do item extraction — shorter prompt, no
// merchant/category reasoning, cheaper than extractFromText even though
// it's still a real model call.
async function extractItemsOnly(text, merchantName) {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 512,
    messages: [{ role: 'user', content: `${itemsOnlyPrompt(merchantName)}\n\nOCR text:\n"""\n${text}\n"""` }],
  })
  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock) throw new Error('No text response from Claude')
  const parsed = parseJsonResponse(textBlock.text)
  return parsed.items || []
}

// Fallback path only: OCR failed to produce usable text (low confidence or
// too short), so this pays the full image-token cost as the price of still
// getting a usable read rather than silently failing.
async function extractFromImage(buffer, contentType) {
  const base64 = buffer.toString('base64')
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: contentType || 'image/jpeg', data: base64 } },
          { type: 'text', text: `${IMAGE_PROMPT}${SHARED_RULES}` },
        ],
      },
    ],
  })
  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock) throw new Error('No text response from Claude')
  return parseJsonResponse(textBlock.text)
}

// Downloads a Twilio inbound-media URL (requires Basic Auth with the same
// Account SID/Auth Token used to send messages) into memory, then runs it
// through OCR before Claude ever sees it — see ocr.js for why. The image
// bytes are never written to disk or Supabase, in either path — held in
// memory just long enough to build the request, then discarded, per the
// "processed and discarded, not retained" product decision (these are
// effectively receipts).
export async function parseScreenshot(mediaUrl, contentType) {
  const buffer = await downloadMedia(mediaUrl)
  const { text: rawText, confidence } = await extractText(buffer)
  // Redacted immediately, before anything downstream sees it — the
  // dictionary lookup and both Claude calls all operate on this, never on
  // rawText. The length/confidence gate below intentionally still checks
  // rawText, since that's measuring OCR signal strength, not how much
  // non-PII content survived redaction.
  const text = redactPII(rawText)

  let merchant, category, rawItems
  // 'dictionary' hits are already zero-token-certain (a deterministic string
  // match), so they skip the confidence gate. 'model' means a model guessed
  // the merchant name — per the guidance doc, that's exactly the case the
  // one-tap confirm chip exists for, both to correct a possible miss and to
  // grow the dictionary from a confirmed answer. See routes/rcs.js.
  let merchantSource = null

  // Tried regardless of OCR confidence, before either fallback tier — see
  // merchantDictionary.js for why this can still hit on otherwise-weak OCR.
  const dictHit = text.length > 0 ? await matchMerchant(text) : null
  if (dictHit) {
    console.log(`[screenshotParser] dictionary hit: ${dictHit.name} — merchant+category cost 0 tokens`)
    merchant = dictHit.name
    category = dictHit.category
    merchantSource = 'dictionary'
    rawItems = await extractItemsOnly(text, dictHit.name)
  } else if (rawText.length >= MIN_OCR_TEXT_LENGTH && confidence >= MIN_OCR_CONFIDENCE) {
    console.log(`[screenshotParser] OCR ok (confidence ${confidence.toFixed(0)}, ${text.length} chars) — text path`)
    const parsed = await extractFromText(text)
    merchant = parsed.merchant
    category = parsed.category
    if (merchant) merchantSource = 'model'
    rawItems = parsed.items || []
  } else {
    // Image fallback: redaction above doesn't apply here — see redact.js's
    // header comment for why that's a known, flagged gap, not an oversight.
    console.log(
      `[screenshotParser] OCR too weak (confidence ${confidence.toFixed(0)}, ${rawText.length} chars) — image fallback`,
    )
    const parsed = await extractFromImage(buffer, contentType)
    merchant = parsed.merchant
    category = parsed.category
    if (merchant) merchantSource = 'model'
    rawItems = parsed.items || []
  }

  const items = await normalizeItems(rawItems)
  return { merchant, category, merchantSource, items }
}
