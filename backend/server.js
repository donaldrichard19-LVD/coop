import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import rcsRouter from './routes/rcs.js'
import waitlistRouter from './routes/waitlist.js'
import dealsRouter from './routes/deals.js'

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/rcs', rcsRouter)
app.use('/api/waitlist', waitlistRouter)
app.use('/api/deals', dealsRouter)

app.get('/health', (_req, res) => res.json({ ok: true }))

const port = process.env.PORT || 3002
app.listen(port, () => console.log(`Coop backend (RCS channel) listening on :${port}`))
