// Stage 3 of the screenshot pipeline: strip PII from OCR text before it
// reaches anything outside Coop's own boundary — the merchant-dictionary
// lookup, and both Claude calls. Runs unconditionally right after OCR, on
// whatever text OCR produced. Deterministic regex only, no model call, per
// the routing rule ("is there one correct answer, would two competent
// people agree" — yes, for these patterns).
//
// Known, deliberate limitation: this only covers the OCR-TEXT path. When
// OCR quality is too low and screenshotParser.js falls back to sending the
// raw image directly to Claude, none of this runs — that image still
// contains whatever PII was on the receipt. Redacting pixels (detecting
// and blacking out PII regions in an image) is a materially harder,
// different problem than this text pass, and isn't built. Flagging this
// explicitly rather than letting "redaction is done" quietly overstate
// what's actually covered.
//
// Deliberately favors over-redaction: telling "the user's own PII" apart
// from incidental non-sensitive text (e.g. a restaurant's own printed
// street address) would need context understanding — exactly what this
// deterministic stage exists to avoid needing. A false positive here costs
// a slightly less complete address string; a false negative leaks a real
// phone number or card digits to a third-party API. Same asymmetric-cost
// reasoning the rest of this pipeline already leans on.

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g
// 13-19 consecutive digits (unspaced), or grouped in 4s (the two common
// real-world card formats) — not "any digit run with arbitrary spacing",
// which would false-positive too easily on OCR-mangled numeric noise.
// Runs before PHONE_RE: a 16-digit card number contains a 10-digit
// substring that PHONE_RE would otherwise partially match first, leaving
// the rest of the card number leaked in plain text.
const CARD_RE = /\b(?:\d{13,19}|\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{1,7})\b/g
const PHONE_RE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g
// Word-continuation groups below deliberately use [ \t]+, not \s+ — \s
// matches newlines too, and a greedy multi-word extension that can cross a
// line break will happily eat into the NEXT field's label (e.g. "Name:
// John Smith\nDelivered to..." matching "John Smith Delivered" as if
// "Delivered" were a third name word). Same-line only avoids that.
const ADDRESS_STREET_RE =
  /\b\d{1,6}\s+[A-Za-z0-9.']{2,25}(?:[ \t]+[A-Za-z0-9.']{1,25}){0,3}[ \t]+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Ct|Court|Pl|Place|Sq|Square|Ter|Terrace)\.?\b/gi
const ADDRESS_CITYSTATEZIP_RE = /\b[A-Za-z][A-Za-z\s]{1,24},\s?[A-Z]{2}\s?\d{5}(?:-\d{4})?\b/g
// Requires an explicit #/: marker after the label, not just the bare word
// "order" — otherwise ordinary prose ("in order to...") would false-match,
// and "confirmed"/"confirmation" would too without a following separator.
// Captures the label so it survives redaction (e.g. "Order #[ORDER#]"
// instead of losing the structural hint entirely).
const ORDER_NUMBER_RE = /\b((?:order|confirmation)\s*(?:no\.?|number)?\s*[#:]\s*)([A-Za-z0-9-]{4,20})\b/gi
const NAME_LABEL_RE =
  /((?:name|customer|delivered to|deliver to|billed to|bill to|attn|attention)\s*:?[ \t]*)[A-Z][a-zA-Z'-]+(?:[ \t]+[A-Z][a-zA-Z'-]+){0,3}/gi

export function redactPII(text) {
  if (!text) return text
  return text
    .replace(EMAIL_RE, '[EMAIL]')
    .replace(CARD_RE, '[CARD]')
    .replace(PHONE_RE, '[PHONE]')
    .replace(ADDRESS_STREET_RE, '[ADDRESS]')
    .replace(ADDRESS_CITYSTATEZIP_RE, '[ADDRESS]')
    .replace(ORDER_NUMBER_RE, '$1[ORDER#]')
    .replace(NAME_LABEL_RE, '$1[NAME]')
}
