import { useCallback, useState } from 'react'

const KEY = 'coop-waitlisted'

// Distinct from useOnboarded (now unused — it gated the old Plaid flow's
// access to live Chat; see BACKLOG.md "Plaid onboarding flow" if that ever
// comes back). "waitlisted" means "submitted the waitlist form," not "has
// real access," since there's no real deal data behind it yet without
// Plaid or screenshot upload.
export default function useWaitlisted() {
  const [waitlisted, setWaitlistedState] = useState(() => localStorage.getItem(KEY) === 'true')

  const setWaitlisted = useCallback((value) => {
    if (value) localStorage.setItem(KEY, 'true')
    else localStorage.removeItem(KEY)
    setWaitlistedState(value)
  }, [])

  return [waitlisted, setWaitlisted]
}
