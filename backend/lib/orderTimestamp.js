// Prerequisite for Story P2-2 (per-user day/time optimization) — order-timestamp
// extraction, stage-adjacent to the screenshot pipeline's existing merchant/item
// extraction. Regex-first per this codebase's established deterministic-first routing rule
// (merchantDictionary.js's dictionary-first, lineItemExtractor.js's regex-first): tried
// before ever asking Claude, and screenshotParser.js only falls through to including
// order_timestamp in the model call's output schema when this returns null.
//
// Targeted formats — chosen from the common real-world receipt/order-confirmation date+time
// conventions the plan called out, since this build's actual eval fixtures
// (backend/eval/screenshots/*.json) do not contain any printed order date/time at all (they
// are trimmed to just merchant header + line items + total), so there was no real fixture
// text to mine formats from:
//   - MM/DD/YYYY h:mm[am/pm]   e.g. "08/11/2026 3:45 PM", "8/11/26 15:45"
//   - Mon DD, YYYY h:mm[am/pm] e.g. "Aug 11, 2026 3:45 PM", "August 11 2026, 15:45"
//   - Mon DD, YYYY             e.g. "Aug 11, 2026" (date only — time defaults to midnight)
//   - MM/DD/YYYY               e.g. "08/11/2026" (date only — time defaults to midnight)
// Tried in that order (most to least specific) so a date+time match is preferred over a
// looser date-only match when both patterns could technically fire on the same text.
//
// Known, deliberate limitation (flagged plainly, matching this codebase's convention —
// redact.js, engagementScoring.js's isWithinRadius, cadenceDecay.js's rolling-timestamp
// note): screenshotParser.js has no account/timezone context (it is a pure OCR-text-in,
// structured-data-out function with no account parameter), so there is no timezone to
// localize the parsed wall-clock numbers against. Rather than fabricating or guessing a
// timezone, the literal printed numbers are interpreted as UTC via Date.UTC(...). This can
// shift the derived day-of-week by one for orders placed close to local midnight — accepted
// because it feeds a soft day-of-week preference signal (preferenceProfile.js), not a hard
// scheduling constraint, and an honest, documented imprecision beats a fabricated timezone.

const MONTH_INDEX = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

const SLASH_DATE_TIME_RE = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})[ ,]+(\d{1,2}):(\d{2})\s*([AaPp][Mm])?\b/
const MONTH_NAME_DATE_TIME_RE =
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})[ ,]+(\d{1,2}):(\d{2})\s*([AaPp][Mm])?\b/i
const MONTH_NAME_DATE_ONLY_RE = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/i
const SLASH_DATE_ONLY_RE = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/

function fullYear(y) {
  if (y >= 100) return y
  return y >= 70 ? 1900 + y : 2000 + y
}

function to24Hour(hour, ampm) {
  if (!ampm) return hour
  const isPM = ampm.toLowerCase() === 'pm'
  if (isPM && hour !== 12) return hour + 12
  if (!isPM && hour === 12) return 0
  return hour
}

// Constructs an ISO string from raw wall-clock components, validating that the components
// round-trip through Date.UTC unchanged (catches e.g. "Feb 30" or month 13, which
// Date.UTC would otherwise silently roll into the following month/day) — returns null
// rather than a plausible-looking but wrong timestamp, matching this pipeline's "never
// guess" convention.
function buildIsoOrNull(year, monthIndex, day, hour, minute) {
  if (monthIndex < 0 || monthIndex > 11) return null
  if (day < 1 || day > 31) return null
  if (hour < 0 || hour > 23) return null
  if (minute < 0 || minute > 59) return null

  const d = new Date(Date.UTC(year, monthIndex, day, hour, minute, 0))
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== monthIndex || d.getUTCDate() !== day) return null
  return d.toISOString()
}

function trySlashDateTime(text) {
  const m = SLASH_DATE_TIME_RE.exec(text)
  if (!m) return null
  const [, mo, d, y, h, min, ampm] = m
  return buildIsoOrNull(fullYear(Number(y)), Number(mo) - 1, Number(d), to24Hour(Number(h), ampm), Number(min))
}

function tryMonthNameDateTime(text) {
  const m = MONTH_NAME_DATE_TIME_RE.exec(text)
  if (!m) return null
  const [, mon, d, y, h, min, ampm] = m
  const monthIndex = MONTH_INDEX[mon.toLowerCase()]
  if (monthIndex == null) return null
  return buildIsoOrNull(Number(y), monthIndex, Number(d), to24Hour(Number(h), ampm), Number(min))
}

function tryMonthNameDateOnly(text) {
  const m = MONTH_NAME_DATE_ONLY_RE.exec(text)
  if (!m) return null
  const [, mon, d, y] = m
  const monthIndex = MONTH_INDEX[mon.toLowerCase()]
  if (monthIndex == null) return null
  return buildIsoOrNull(Number(y), monthIndex, Number(d), 0, 0)
}

function trySlashDateOnly(text) {
  const m = SLASH_DATE_ONLY_RE.exec(text)
  if (!m) return null
  const [, mo, d, y] = m
  return buildIsoOrNull(fullYear(Number(y)), Number(mo) - 1, Number(d), 0, 0)
}

/**
 * Pure. Given OCR-extracted (or otherwise plain) text, returns an ISO 8601 timestamp string
 * for the first plausible order date/time found, trying date+time patterns before
 * date-only patterns, or null if nothing matched or every match was calendar-invalid.
 */
export function extractOrderTimestamp(text) {
  if (!text) return null
  return trySlashDateTime(text) || tryMonthNameDateTime(text) || tryMonthNameDateOnly(text) || trySlashDateOnly(text) || null
}

/**
 * Pure. Validates and normalizes a model-provided order_timestamp value (screenshotParser.js's
 * Claude-schema fallback, only reached when extractOrderTimestamp above found nothing) into
 * a well-formed ISO string, or null if the value is missing/unparseable — never trusts the
 * model's string verbatim without confirming it actually parses to a real instant.
 */
export function normalizeTimestamp(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
