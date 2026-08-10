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
export async function extractText(buffer) {
  const worker = await createWorker('eng')
  try {
    const {
      data: { text, confidence },
    } = await worker.recognize(buffer)
    return { text: text.trim(), confidence }
  } finally {
    await worker.terminate()
  }
}
