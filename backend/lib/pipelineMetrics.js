// Story B3 — lightweight structured metrics for the screenshot pipeline: console.log lines
// with a consistent, greppable shape, NOT a new Supabase table. Chosen over a table because
// every existing signal in this pipeline (dictionary hits, cache hits, fallback-tier
// choice) is already surfaced via plain console.log lines with a `[module]` prefix — see
// merchantDictionary.js, itemNormalization.js, screenshotParser.js. A metrics table would
// be a second, parallel logging system rather than reinforcing the one this codebase
// already leans on everywhere else, and Coop has no log-aggregation/analytics
// infrastructure yet for a table's structured rows to have any advantage over a log line
// (no dashboard reads either one today). Revisit if/when real volume makes ad-hoc log-line
// grepping too slow to answer a hit-rate question, at which point a table with real indexes
// earns its added complexity.
//
// Every call site passes a stable `event` name and a flat `fields` object — deliberately
// unstructured beyond that (no schema enforcement here) so this stays a thin, dependency-free
// helper rather than a second thing to keep in sync with a changing metrics shape.

export function recordMetric(event, fields = {}) {
  console.log(`[pipelineMetrics] ${event} ${JSON.stringify(fields)}`)
}
