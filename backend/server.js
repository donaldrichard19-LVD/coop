import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import rcsRouter from './routes/rcs.js'
import waitlistRouter from './routes/waitlist.js'
import dealsRouter from './routes/deals.js'
import { startEngagementScheduler } from './lib/engagementScheduler.js'

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/rcs', rcsRouter)
app.use('/api/waitlist', waitlistRouter)
app.use('/api/deals', dealsRouter)

app.get('/health', (_req, res) => res.json({ ok: true }))

const port = process.env.PORT || 3002
app.listen(port, () => console.log(`Coop backend (RCS channel) listening on :${port}`))

// Story A1 — proactive engagement cadence, in-process cron inside this same Express
// service (no new service/process type, per the build plan).
startEngagementScheduler()
