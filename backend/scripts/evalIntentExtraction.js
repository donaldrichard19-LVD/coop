import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractIntent } from '../lib/intentExtraction.js'

// Story A15 — eval harness for Story A13's intent extraction. Runs every fixture in
// eval/intentExtraction/*.json through the real extractIntent() call and scores field-level
// agreement against each fixture's `expected` shape.
//
// IMPORTANT, and noted per the plan: this is the one eval in this build that cannot be run
// fully credential-free — it exercises a real Anthropic API call per fixture (151 of them),
// so it needs ANTHROPIC_API_KEY set to a real key. Without one, this script skips
// gracefully (prints a message, exits 0) rather than failing loudly, matching the
// credential-less no-op convention every Twilio-touching path in this codebase already
// follows — this is the equivalent for the one Anthropic-touching eval.
//
// The fixture sets themselves are SYNTHETIC — templated/generated, not real logged
// messages (no real inbound message log exists yet). Treat this as a placeholder baseline
// to sanity-check the extraction prompt, not a ground-truth benchmark; replace with real
// logged messages post-launch, per the plan.
//
// Run with: npm run eval:intent

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_DIR = path.join(__dirname, '..', 'eval', 'intentExtraction')

function loadFixtures() {
  const files = fs.readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json'))
  const fixtures = []
  for (const file of files) {
    const category = path.basename(file, '.json')
    const rows = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf8'))
    for (const row of rows) fixtures.push({ ...row, fixtureCategory: category })
  }
  return fixtures
}

// Only score fields the fixture actually asserts something meaningful about — most fixtures
// don't specify every field (e.g. a multi-constraint fixture about category+price says
// nothing about merchant), so comparing against undefined fields would understate accuracy
// on fields the fixture author never intended to check. Every fixture generated here does
// specify all seven fields explicitly (nulls included), so this is mostly a safety net for
// hand-added fixtures that don't.
const SCORED_FIELDS = ['category', 'maxPrice', 'minPrice', 'maxDistanceMiles', 'merchant', 'timeWindow', 'needsClarification']

function scoreFixture(expected, actual) {
  let matched = 0
  let total = 0
  for (const field of SCORED_FIELDS) {
    if (!(field in expected)) continue
    total++
    if (expected[field] === actual[field]) matched++
  }
  return { matched, total }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('[evalIntentExtraction] ANTHROPIC_API_KEY not set — skipping (this eval requires a real model call).')
    process.exit(0)
  }

  const fixtures = loadFixtures()
  console.log(`[evalIntentExtraction] running ${fixtures.length} fixtures across ${new Set(fixtures.map((f) => f.fixtureCategory)).size} categories...\n`)

  const byCategory = {}
  let totalMatched = 0
  let totalFields = 0
  let failures = 0

  for (const fixture of fixtures) {
    byCategory[fixture.fixtureCategory] ??= { matched: 0, total: 0, count: 0 }
    try {
      const actual = await extractIntent({
        message: fixture.message,
        profile: { uploadCount: 3, topCategories: [], merchantNames: new Set() },
        timezone: 'America/Los_Angeles',
        lastOutboundText: fixture.lastOutboundText,
      })
      const { matched, total } = scoreFixture(fixture.expected, actual)
      byCategory[fixture.fixtureCategory].matched += matched
      byCategory[fixture.fixtureCategory].total += total
      byCategory[fixture.fixtureCategory].count += 1
      totalMatched += matched
      totalFields += total
    } catch (err) {
      failures++
      console.error(`[evalIntentExtraction] ${fixture.id} failed: ${err.message}`)
    }
  }

  console.log('\n--- results by category ---')
  for (const [category, stats] of Object.entries(byCategory)) {
    const pct = stats.total > 0 ? ((stats.matched / stats.total) * 100).toFixed(1) : 'n/a'
    console.log(`${category}: ${stats.matched}/${stats.total} fields matched (${pct}%), ${stats.count} fixtures`)
  }

  console.log('\n--- overall ---')
  console.log(`field-level accuracy: ${totalMatched}/${totalFields} (${totalFields > 0 ? ((totalMatched / totalFields) * 100).toFixed(1) : 'n/a'}%)`)
  console.log(`fixtures with a hard failure (exception, not a scoring miss): ${failures}/${fixtures.length}`)
}

main().catch((err) => {
  console.error('[evalIntentExtraction] fatal:', err)
  process.exit(1)
})
