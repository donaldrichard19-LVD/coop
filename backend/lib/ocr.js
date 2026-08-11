import { createWorker } from 'tesseract.js'

// Stage 2 of the screenshot pipeline: pixels -> text, before any model call
// sees the image. A full-resolution phone screenshot costs roughly 4-5k
// image tokens; the same receipt as OCR text costs roughly 250-400 tokens —
// this is the single biggest cost lever in the whole pipeline, so it runs
// unconditionally before screenshotParser.js ever talks to Claude.
//
// Spins up a fresh worker per call rather than pooling one long-lived
// worker — simplest correct thing at Coop's current (near-zero) volume;
// revisit if/when real throughput makes worker reuse worth the added
// complexity of lifecycle management.

// Story B2 prerequisite: by default, tesseract.js v7's recognize() does NOT return
// per-word bounding boxes — `data.blocks` is null unless the `blocks: true` output option
// is explicitly requested (confirmed against node_modules/tesseract.js/src/index.d.ts:
// `blocks: Block[] | null`, and OutputFormats.blocks defaults falsy). lib/lineItemExtractor.js
// (B2) and lib/redactImage.js (B4) both need real word/line positions, not just flat text,
// so this now requests blocks output and flattens it into a `lines` array alongside the
// plain `text`/`confidence` every existing caller already relies on — a strictly additive
// change, nothing existing that only destructures {text, confidence} is affected.
function flattenLines(blocks) {
  const lines = []
  for (const block of blocks || []) {
    for (const paragraph of block.paragraphs || []) {
      for (const line of paragraph.lines || []) {
        lines.push({
          text: line.text,
          bbox: line.bbox,
          words: (line.words || []).map((w) => ({ text: w.text, confidence: w.confidence, bbox: w.bbox })),
        })
      }
    }
  }
  return lines
}

export async function extractText(buffer) {
  const worker = await createWorker('eng')
  try {
    const {
      data: { text, confidence, blocks },
    } = await worker.recognize(buffer, {}, { blocks: true })
    return { text: text.trim(), confidence, lines: flattenLines(blocks) }
  } finally {
    await worker.terminate()
  }
}
