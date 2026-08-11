import { anthropic } from './anthropic.js'

// Story A13 — model-based intent extraction for on-demand search requests: the fallback
// bucket A9's classifyInbound routes to (type: 'search_or_unclassifiable'). Structured JSON
// filters only, no prose — consumed by A14's onDemandRetrieval.js. This is the one new
// model-call path in the engagement build (alongside A10's ambiguous-feedback classifier
// and A14's empty-result composition), so it's the one piece of A15's eval harness that
// can't be run fully credential-free — see evalIntentExtraction.js.

const SYSTEM_PROMPT = `You extract structured search filters from a single inbound text message to a deals-finder texting assistant.

Judgment rules:
- In-the-moment constraints in the message OVERRIDE the user's historical profile — don't average them together. If the message says "under $10" and the profile's usual price tier is higher, "under $10" wins outright.
- Any dimension not stated in the message AND not covered by the profile returns null. Never guess a value that isn't grounded in the message or the profile summary.
- Don't invent constraints. Mentioning a cuisine is not a price signal. Mentioning a time is not a distance signal. Only extract what the message actually implies.
- If the message expresses two constraints that conflict (e.g. "cheap but fancy"), return both — don't silently drop one to resolve the conflict yourself.
- If the message is genuinely unclear (not enough signal to search on at all), set needsClarification true with one short clarifying question, rather than guessing at filters.
- Resolve relative time expressions ("tonight", "this weekend") against the user's local time, given below. If timezone is unknown, resolve loosely and don't overclaim precision.

Return ONLY JSON in this exact shape, no markdown fences, no prose:
{
  "category": string|null,
  "maxPrice": number|null,
  "minPrice": number|null,
  "maxDistanceMiles": number|null,
  "merchant": string|null,
  "timeWindow": string|null,
  "needsClarification": boolean,
  "clarifyingQuestion": string|null
}`

// 100-150 tokens, built from preferenceProfile.js's already-aggregated output — NOT raw
// item history, per the plan's explicit instruction. Price tier and geography aren't
// modeled anywhere in this codebase yet (preferenceProfile.js has no such fields), so
// they're omitted here rather than guessed at.
export function buildProfileSummary(profile) {
  if (!profile || profile.uploadCount === 0) return 'No profile data available yet.'
  const topCategories = (profile.topCategories || []).slice(0, 5).join(', ') || 'none yet'
  const merchants = [...(profile.merchantNames || [])].slice(0, 8).join(', ') || 'none yet'
  return `Top categories (most to least frequent): ${topCategories}. Frequent merchants: ${merchants}.`
}

function parseJsonResponse(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  return JSON.parse(cleaned)
}

/**
 * message: inbound text. profile: lib/preferenceProfile.js#getPreferenceProfile shape.
 * timezone: account's IANA timezone (may be null — accounts.timezone is nullable, see
 * zipTimezone.js), used to resolve relative time expressions; loosely handled when absent.
 * lastOutboundText: the account's last-sent message text — only pass this when the inbound
 * message plausibly refers back to it anaphorically (the caller's judgment call, e.g. A9
 * already found hasPendingTurn true), per the plan's explicit scoping of when this context
 * should be included at all.
 */
export async function extractIntent({ message, profile, timezone, lastOutboundText = null }) {
  const profileSummary = buildProfileSummary(profile)
  const now = timezone
    ? new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: timezone }).format(new Date())
    : new Date().toISOString()

  const contextLines = [
    `User's local time: ${now}${timezone ? '' : ' (timezone unknown — resolve relative time loosely)'}`,
    `Profile summary: ${profileSummary}`,
  ]
  if (lastOutboundText) {
    contextLines.push(`Most recent message we sent them (for anaphoric reference only): ${JSON.stringify(lastOutboundText)}`)
  }
  contextLines.push(`User's message: ${JSON.stringify(message)}`)

  const result = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: contextLines.join('\n') }],
  })
  const textBlock = result.content.find((b) => b.type === 'text')
  if (!textBlock) throw new Error('No text response from Claude')
  return parseJsonResponse(textBlock.text)
}
