import 'dotenv/config'
import { CONFIRM_MERCHANT_TEMPLATE } from '../rcs/templates.js'

// One-off, narrower sibling of provisionTemplates.js — that script loops over
// ALL_TEMPLATES unconditionally, which would create duplicates of the 4 templates
// (card/carousel/chipsOpening/chipsFollowup) already provisioned and already referenced by
// SIDs set on Render. This creates only the one still-missing template
// (coop_rcs_confirm_merchant, the B1 gap tracked in BACKLOG.md), so it's safe to run
// without touching anything already live.
//
// Run with: node scripts/provisionConfirmMerchantTemplate.js
// Requires TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN in backend/.env (same account-level
// credentials already used for the other 4 templates on Render — no new Twilio account
// needed, just the same two values).

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN

if (!accountSid || !authToken) {
  console.error('Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in backend/.env first.')
  process.exit(1)
}

const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

const res = await fetch('https://content.twilio.com/v1/Content', {
  method: 'POST',
  headers: {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(CONFIRM_MERCHANT_TEMPLATE),
})
const json = await res.json()
if (!res.ok) {
  console.error(`Failed: ${res.status} ${JSON.stringify(json)}`)
  process.exit(1)
}

console.log(`Created ${CONFIRM_MERCHANT_TEMPLATE.friendly_name} -> ${json.sid}`)
console.log(`\nAdd to Render's env vars (dashboard, not render.yaml — it's a sync:false secret):\n`)
console.log(`RCS_TEMPLATE_CONFIRM_MERCHANT_SID=${json.sid}`)
console.log(
  '\nNote: creating a template does not submit it for RCS carrier/Google approval —' +
    ' that\'s a separate step in the Twilio console once your RCS agent is set up.',
)
