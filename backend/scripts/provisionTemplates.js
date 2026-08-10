import 'dotenv/config'
import { ALL_TEMPLATES } from '../rcs/templates.js'

// One-time setup — NOT run automatically. Creates each Content API template and prints
// the SIDs to paste into .env as RCS_TEMPLATE_*_SID. Requires TWILIO_ACCOUNT_SID/
// TWILIO_AUTH_TOKEN for a real account; does nothing destructive if run again (Twilio
// versions templates by content, but re-running will create duplicates under the same
// friendly_name — check the console before re-running).
//
// Run with: npm run provision:rcs

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN

if (!accountSid || !authToken) {
  console.error('Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in backend/.env first.')
  process.exit(1)
}

const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

async function createTemplate(name, definition) {
  const res = await fetch('https://content.twilio.com/v1/Content', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(definition),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(`${name}: ${res.status} ${JSON.stringify(json)}`)
  }
  return json.sid
}

const envKeyByTemplate = {
  card: 'RCS_TEMPLATE_CARD_SID',
  carousel: 'RCS_TEMPLATE_CAROUSEL_SID',
  chipsOpening: 'RCS_TEMPLATE_CHIPS_OPENING_SID',
  chipsFollowup: 'RCS_TEMPLATE_CHIPS_FOLLOWUP_SID',
  confirmMerchant: 'RCS_TEMPLATE_CONFIRM_MERCHANT_SID',
}

const results = {}
for (const [key, definition] of Object.entries(ALL_TEMPLATES)) {
  console.log(`Creating ${definition.friendly_name}...`)
  results[key] = await createTemplate(key, definition)
  console.log(`  -> ${results[key]}`)
}

console.log('\nAdd these to backend/.env:\n')
for (const [key, sid] of Object.entries(results)) {
  console.log(`${envKeyByTemplate[key]}=${sid}`)
}

console.log(
  '\nNote: creating a template does not submit it for RCS carrier/Google approval —' +
    ' that\'s a separate step in the Twilio console once your RCS agent is set up.',
)
