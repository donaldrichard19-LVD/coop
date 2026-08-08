import { createContext, useContext, useMemo, useState } from 'react'
import { deals, categoryBreakdown, savingsThisMonth } from './deals'

const DealsContext = createContext(null)

export function DealsProvider({ children }) {
  const [savedIds, setSavedIds] = useState(() => new Set(['d-lucky']))

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
      savedIds,
      toggleSave,
      isSaved: (id) => savedIds.has(id),
      savedDeals: deals.filter((d) => savedIds.has(d.id)),
      nearbyDeals: deals.filter((d) => d.status !== 'expired'),
      usedDeals: deals.filter((d) => d.status === 'used'),
      categoryBreakdown,
      savingsThisMonth,
    }),
    [savedIds],
  )

  return <DealsContext.Provider value={value}>{children}</DealsContext.Provider>
}

export function useDeals() {
  return useContext(DealsContext)
}
