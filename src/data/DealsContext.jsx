import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { fetchDeals } from '../lib/api'
import { categoryBreakdown, savingsThisMonth } from './deals'

const DealsContext = createContext(null)

export function DealsProvider({ children }) {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [savedIds, setSavedIds] = useState(() => new Set())

  useEffect(() => {
    let cancelled = false
    fetchDeals()
      .then((data) => {
        if (!cancelled) setDeals(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function toggleSave(id) {
    setSavedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const value = useMemo(
    () => ({
      deals,
      loading,
      error,
      savedIds,
      toggleSave,
      isSaved: (id) => savedIds.has(id),
      savedDeals: deals.filter((d) => savedIds.has(d.id)),
      nearbyDeals: deals.filter((d) => d.status !== 'expired'),
      usedDeals: deals.filter((d) => d.status === 'used'),
      categoryBreakdown,
      savingsThisMonth,
    }),
    [deals, loading, error, savedIds],
  )

  return <DealsContext.Provider value={value}>{children}</DealsContext.Provider>
}

export function useDeals() {
  return useContext(DealsContext)
}
