import sharp from 'sharp'
import { redactPII } from './redact.js'

// Story B4 — PII redaction on the image-fallback path (screenshotParser.js's
// extractFromImage), a real privacy bug flagged in redact.js's own header comment and in
// BACKLOG.md: redact.js's regex redaction only ever ran on the OCR-TEXT path. When OCR
// quality was too low to trust for extraction, the raw image — with whatever PII is
// printed on it — was sent to Claude untouched. This module closes that gap using the OCR
// data collected during ocr.js's low-confidence pass (the very pass that triggered the
// image fallback in the first place) as a coarse redaction map.
//
// Honest scope, matching redact.js's own "known, deliberate limitation" commenting
// convention — no overclaiming:
//   - Covers ONLY PII that low-confidence OCR still managed to read as recognizable text
//     (the same email/phone/card/address/order#/name patterns redact.js's regexes already
//     detect). PII in a font/layout/orientation OCR couldn't read AT ALL is invisible to
//     this pass too — there is no way to redact pixels the text layer never saw. A
//     sufficiently garbled or sideways receipt still gets zero redaction coverage here,
//     same as it would get zero benefit from the text-path redaction elsewhere.
//   - Redacts at LINE granularity, not per-character: if any redact.js pattern matches
//     anywhere in an OCR line's text, every word on that line is blacked out — not just the
//     matched substring. This deliberately over-redacts, on purpose, mirroring the exact
//     asymmetric-cost reasoning redact.js's header comment already states for the text
//     path: a slightly more-blacked-out receipt costs one less-complete address string; a
//     false negative here leaks a real phone number or card digits to a third-party API.
//     Precise character-to-word-bbox mapping (only blacking out the exact matched
//     substring) was deliberately not attempted — OCR word segmentation doesn't reliably
//     support it, and the cost asymmetry above means the coarser approach is the right
//     tradeoff, not a shortcut.
//
// Operates entirely on the in-memory buffer already present in screenshotParser.js's flow
// and returns a new in-memory buffer — the existing "image never persisted" retention
// guarantee is unaffected; nothing here writes to disk or Supabase.

function lineHasPII(lineText) {
  return !!lineText && redactPII(lineText) !== lineText
}

/**
 * buffer: original image bytes. lines: ocr.js#extractText's `lines` output (array of
 * { text, bbox, words: [{ text, bbox }] }) — the same low-confidence OCR pass that decided
 * to fall back to the image path in the first place. contentType: the original media
 * content type, used to pick the re-encoding format so the output stays compatible with
 * what screenshotParser.js sends to Claude.
 *
 * Returns a new Buffer with every word on a PII-flagged line blacked out. If no line
 * matched (including the case where OCR produced no lines at all — e.g. a truly illegible
 * image), returns the original buffer unchanged so no redundant re-encode cost is paid and
 * no silent quality loss is introduced when there was nothing to redact.
 */
export async function redactImagePII(buffer, lines, contentType) {
  const piiLines = (lines || []).filter((line) => lineHasPII(line.text))
  const rectangles = piiLines.flatMap((line) => (line.words || []).map((w) => w.bbox).filter(Boolean))

  if (rectangles.length === 0) return buffer

  let metadata
  try {
    metadata = await sharp(buffer).metadata()
  } catch (err) {
    console.error('[redactImage] failed to read image metadata — sending unredacted image:', err.message)
    return buffer
  }

  const svgRects = rectangles
    .map((b) => `<rect x="${b.x0}" y="${b.y0}" width="${Math.max(0, b.x1 - b.x0)}" height="${Math.max(0, b.y1 - b.y0)}" fill="black"/>`)
    .join('')
  const svgOverlay = Buffer.from(`<svg width="${metadata.width || 0}" height="${metadata.height || 0}">${svgRects}</svg>`)

  const format = (contentType || '').includes('png') ? 'png' : 'jpeg'

  try {
    const redacted = await sharp(buffer).composite([{ input: svgOverlay, top: 0, left: 0 }])[format]().toBuffer()
    console.log(`[redactImage] redacted ${rectangles.length} word(s) across ${piiLines.length} PII-flagged line(s) before image fallback`)
    return redacted
  } catch (err) {
    // Fail closed toward NOT sending an unredacted image with known PII: if the redaction
    // composite itself fails, this is the one case worth throwing rather than silently
    // falling back to the raw buffer, since we already know PII is present.
    console.error('[redactImage] redaction compositing failed:', err.message)
    throw err
  }
}
