import express from 'express'
import { fetchDeals } from '../lib/deals.js'

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const deals = await fetchDeals()
    res.json({ deals })
  } catch (err) {
    console.error('[deals] fetch failed:', err.message)
    res.status(500).json({ error: 'Failed to load deals' })
  }
})

export default router
