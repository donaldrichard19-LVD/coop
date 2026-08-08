import { useCallback, useState } from 'react'

const KEY = 'coop-onboarded'

// No real backend/auth exists yet — this is the same kind of "is there a
// session" flag a real account system would provide, standing in for one
// until Plaid/auth are actually built.
export default function useOnboarded() {
  const [onboarded, setOnboardedState] = useState(() => localStorage.getItem(KEY) === 'true')

  const setOnboarded = useCallback((value) => {
    if (value) localStorage.setItem(KEY, 'true')
    else localStorage.removeItem(KEY)
    setOnboardedState(value)
  }, [])

  return [onboarded, setOnboarded]
}
