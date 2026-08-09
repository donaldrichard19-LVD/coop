import express from 'express'
import crypto from 'node:crypto'
import { Resend } from 'resend'
import { sendRcsTurn } from '../lib/twilioClient.js'
import { supabase } from '../lib/supabase.js'

const router = express.Router()

const BASE_URL = (process.env.BACKEND_URL || 'http://localhost:3002').replace(/\/$/, '')

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (digits.length !== 10) return null
  return `+1${digits}`
}

// Mirrors Calvin's routes/waitlist.js signToken/approveUrl pattern exactly,
// just signed on phone instead of email since Coop's waitlist collects
// phone + name, not email.
function signToken(phone) {
  const secret = process.env.WAITLIST_SECRET
  if (!secret) throw new Error('WAITLIST_SECRET not set')
  return crypto.createHmac('sha256', secret).update(phone).digest('hex')
}

// Returns null (not a throw) when WAITLIST_SECRET isn't configured, so a
// signup submission still succeeds and gets emailed — just without the
// one-click approve button — rather than the whole request 500ing over a
// missing secret that has nothing to do with capturing the lead.
function approveUrl(phone, name) {
  let token
  try {
    token = signToken(phone)
  } catch {
    return null
  }
  const params = new URLSearchParams({ phone, token, name: name || '' })
  return `${BASE_URL}/api/waitlist/approve?${params}`
}

router.post('/', async (req, res) => {
  const { name, phone: rawPhone } = req.body
  const phone = normalizePhone(rawPhone)
  if (!phone) {
    return res.status(400).json({ error: 'Valid 10-digit phone number required' })
  }

  // Mirrors Calvin's signups-table upsert (onConflict + ignoreDuplicates so a
  // resubmit doesn't error or duplicate). Not wrapped together with the email
  // send below — a DB hiccup shouldn't block the notification email, and vice
  // versa, so the lead is captured somewhere even if one path fails.
  const { error: dbError } = await supabase
    .from('waitlist_signups')
    .upsert({ phone, name: name || null }, { onConflict: 'phone', ignoreDuplicates: true })
  if (dbError) {
    console.error('[waitlist] failed to persist signup:', dbError.message)
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const link = approveUrl(phone, name)
    const cta = link
      ? `<p>
          <a href="${link}" style="display:inline-block;background:#0e7c57;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;">
            Send welcome text to ${name || phone}
          </a>
        </p>
        <p style="font-size:12px;color:#94a3b8">Sends one RCS/SMS message via the Twilio backend. Safe to click once you're ready to bring them in.</p>`
      : `<p style="font-size:12px;color:#94a3b8">Set WAITLIST_SECRET on the backend to enable a one-click "send welcome text" button here.</p>`
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Coop <hello@getcoop.cash>',
      to: 'donald.richard19@gmail.com',
      subject: `New Coop signup: ${name || phone}`,
      html: `
        <p><strong>${name || 'Someone'}</strong> signed up for Coop.</p>
        <p>Phone: <strong>${phone}</strong></p>
        ${cta}
      `,
    })
  } catch (err) {
    console.error('[waitlist] notification email failed:', err.message)
  }

  res.json({ success: true })
})

// Admin-only: fires when Donald clicks the button in the notification email.
router.get('/approve', async (req, res) => {
  const { phone, token, name } = req.query
  if (!phone || !token) return res.status(400).send('Missing phone or token')

  let expected
  try {
    expected = signToken(phone)
  } catch {
    return res.status(500).send('WAITLIST_SECRET not configured on the backend')
  }
  const tokenBuf = Buffer.from(token)
  const expectedBuf = Buffer.from(expected)
  if (tokenBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
    return res.status(403).send('Invalid token')
  }

  try {
    const firstName = name ? name.split(' ')[0] : 'there'
    await sendRcsTurn(
      phone,
      {
        text: `hey ${firstName} — it's Coop. you're in. we're lining up your first deals now and will text again soon.`,
        deals: [],
        quickReplies: [],
      },
      { isFirstTurn: true },
    )
    res.send(`<p style="font-family:sans-serif">✅ Welcome text sent to <strong>${name || phone}</strong> (${phone}).</p>`)
  } catch (err) {
    console.error('[waitlist] welcome text failed:', err.message)
    res.status(500).send(`Failed to send welcome text: ${err.message}`)
  }
})

export default router
