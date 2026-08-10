import { anthropic } from './anthropic.js'

const EXTRACTION_PROMPT = `You are extracting structured data from a screenshot of a food/delivery order or receipt.

Return ONLY valid JSON in this exact shape — no markdown fences, no explanation, nothing else:
{"merchant": string|null, "category": string, "items": [{"name": string, "category": string|null}]}

Rules:
- "merchant" is the specific business name (e.g. "Blue Bottle Coffee"). Only set it when you can identify the specific business with real confidence — otherwise null.
- "category" is REQUIRED, always filled in even when merchant is null: a general type of place or cuisine (e.g. "mexican", "coffee", "dessert", "pizza", "sushi", "fast casual"). Never leave it blank — this is the fallback when the specific merchant isn't identifiable.
- "items" lists individual food/drink items visible in the order, each with a best-guess category. Empty array if none are legible.
- If the image isn't a food/order screenshot at all, return {"merchant": null, "category": "unknown", "items": []}.`

function parseJsonResponse(text) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
  return JSON.parse(cleaned)
}

// Downloads a Twilio inbound-media URL (requires Basic Auth with the same
// Account SID/Auth Token used to send messages) into memory, sends it to
// Claude for extraction, and returns the parsed result. The image bytes are
// never written to disk or Supabase — held in memory just long enough to
// build the request, then discarded, per the "processed and discarded, not
// retained" product decision (these are effectively receipts).
export async function parseScreenshot(mediaUrl, contentType) {
  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
  const imageRes = await fetch(mediaUrl, { headers: { Authorization: `Basic ${auth}` } })
  if (!imageRes.ok) throw new Error(`Failed to download media: HTTP ${imageRes.status}`)
  const buffer = Buffer.from(await imageRes.arrayBuffer())
  const base64 = buffer.toString('base64')

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: contentType || 'image/jpeg', data: base64 } },
          { type: 'text', text: EXTRACTION_PROMPT },
        ],
      },
    ],
  })

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock) throw new Error('No text response from Claude')
  return parseJsonResponse(textBlock.text)
}
