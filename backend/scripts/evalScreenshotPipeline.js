import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { matchMerchantAgainstDictionary } from '../lib/merchantDictionary.js'
import { extractLineItems } from '../lib/lineItemExtractor.js'
import { redactPII } from '../lib/redact.js'

// Story B3 — eval harness for the screenshot pipeline's DETERMINISTIC stages: merchant
// dictionary matching (stage 4) and regex line-item extraction (stage 5, Story B2). Runs
// entirely credential-free and without a live Supabase connection, unlike A15's intent-
// extraction eval — deliberately scoped this way:
//   - The pipeline's model-based stages (extractFromText/extractFromImage in
//     screenshotParser.js) need real screenshot images this repo doesn't have and a real
//     Anthropic key; evaluating them is out of reach for a local fixture-based harness.
//   - The deterministic stages are exactly what this story's own metrics ask about
//     (dictionary hit rate, regex-vs-model resolution rate) — so this is the harness that
//     actually answers those questions, not a lesser substitute for a full-pipeline eval.
//
// The fixture set (backend/eval/screenshots/*.json, ~190 cases across 5 platforms) is
// SYNTHETIC — generated from the real merchant_dictionary seed data
// (supabase/migrations/20260810000000_create_merchant_dictionary.sql), not real logged
// screenshots (none exist yet). Treat this as a baseline sanity check on the matching
// logic, not a ground-truth benchmark — replace with real labeled screenshots once real
// upload volume exists, same caveat as A15's fixture set.
//
// Run with: npm run eval:screenshots

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_DIR = path.join(__dirname, '..', 'eval', 'screenshots')

// Mirrors the real merchant_dictionary table's seed rows — kept local so this eval never
// needs a live Supabase connection. If the real seed data changes, this should be updated
// to match (see the migration file referenced above); a drift between the two would make
// this eval's hit-rate numbers misleading rather than wrong outright, so it's worth
// keeping in sync deliberately, not just at generation time.
const DICTIONARY = [
  { name: 'Blue Bottle Coffee', category: 'coffee', match_strings: ['blue bottle'] },
  { name: 'Chipotle', category: 'fast casual', match_strings: ['chipotle'] },
  { name: 'Panera Bread', category: 'fast casual', match_strings: ['panera'] },
  { name: "Tony's Pizza Napoletana", category: 'restaurant', match_strings: ["tony's pizza", 'tonys pizza'] },
  { name: "Pete's Coffee", category: 'coffee', match_strings: ["pete's coffee", 'petes coffee'] },
  { name: 'Lucky Dumpling House', category: 'restaurant', match_strings: ['lucky dumpling'] },
  { name: 'Ritual Coffee Roasters', category: 'coffee', match_strings: ['ritual coffee'] },
  { name: 'Starbucks', category: 'coffee', match_strings: ['starbucks'] },
  { name: "McDonald's", category: 'fast casual', match_strings: ["mcdonald's", 'mcdonalds'] },
  { name: 'Subway', category: 'fast casual', match_strings: ['subway'] },
  { name: "Domino's Pizza", category: 'pizza', match_strings: ["domino's", 'dominos'] },
  { name: 'Taco Bell', category: 'mexican', match_strings: ['taco bell'] },
  { name: "Dunkin'", category: 'coffee', match_strings: ['dunkin'] },
  { name: "Wendy's", category: 'fast casual', match_strings: ["wendy's", 'wendys'] },
  { name: 'Panda Express', category: 'fast casual', match_strings: ['panda express'] },
]

function loadFixtures() {
  const files = fs.readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json'))
  const fixtures = []
  for (const file of files) {
    const rows = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf8'))
    for (const row of rows) fixtures.push(row)
  }
  return fixtures
}

function main() {
  const fixtures = loadFixtures()
  console.log(`[evalScreenshotPipeline] running ${fixtures.length} fixtures across ${new Set(fixtures.map((f) => f.platform)).size} platforms...\n`)

  const byPlatform = {}
  let dictHits = 0
  let dictCorrect = 0 // hit AND matched the expected merchant (or correctly found nothing for a true-negative fixture)
  let regexResolved = 0
  let regexConsistentWithExpectedCount = 0

  for (const fixture of fixtures) {
    byPlatform[fixture.platform] ??= { count: 0, dictHits: 0, dictCorrect: 0, regexResolved: 0 }
    const stats = byPlatform[fixture.platform]
    stats.count++

    // Stage 3 (redaction) sanity check, folded in here since it runs on every fixture's
    // text unconditionally in the real pipeline too — not separately scored, just
    // exercised so a redaction crash on any fixture's text would surface here.
    redactPII(fixture.ocrText)

    const dictResult = matchMerchantAgainstDictionary(fixture.ocrText, DICTIONARY)
    if (dictResult) {
      dictHits++
      stats.dictHits++
    }
    const expectedMerchant = fixture.expected?.merchant ?? null
    const dictCorrectForFixture = (dictResult?.name ?? null) === expectedMerchant
    if (dictCorrectForFixture) {
      dictCorrect++
      stats.dictCorrect++
    }

    const regexResult = extractLineItems(fixture.lines)
    if (regexResult) {
      regexResolved++
      stats.regexResolved++
      const expectedCount = (fixture.expected?.itemNames || []).length
      if (regexResult.items.length === expectedCount) regexConsistentWithExpectedCount++
    }
  }

  console.log('--- dictionary matching, by platform ---')
  for (const [platform, s] of Object.entries(byPlatform)) {
    console.log(
      `${platform}: ${s.count} fixtures, hit rate ${((s.dictHits / s.count) * 100).toFixed(1)}%, correct (hit matches expected, including true negatives) ${((s.dictCorrect / s.count) * 100).toFixed(1)}%`,
    )
  }

  console.log('\n--- line-item extraction (Story B2 regex path) ---')
  console.log(`resolved by regex (would skip the model item-extraction call): ${regexResolved}/${fixtures.length} (${((regexResolved / fixtures.length) * 100).toFixed(1)}%)`)
  console.log(`of those, item COUNT matched the fixture's expected count: ${regexConsistentWithExpectedCount}/${regexResolved || 1}`)

  console.log('\n--- overall ---')
  console.log(`dictionary hit rate: ${dictHits}/${fixtures.length} (${((dictHits / fixtures.length) * 100).toFixed(1)}%)`)
  console.log(`dictionary correctness (hit/no-hit matches expected): ${dictCorrect}/${fixtures.length} (${((dictCorrect / fixtures.length) * 100).toFixed(1)}%)`)
}

main()
