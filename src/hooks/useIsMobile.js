import { useEffect, useState } from 'react'

// Matches Tailwind's `md` breakpoint (768px) already used throughout the app
// (Drawer.jsx's `md:flex` etc.) — below it counts as "mobile" for the
// signup-gate: desktop never gets past the static value-prop landing.
const QUERY = '(max-width: 767px)'

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(QUERY).matches)

  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isMobile
}
