import { Routes, Route } from 'react-router-dom'
import DesktopLanding from './pages/DesktopLanding'
import OnboardingFlow from './pages/onboarding/OnboardingFlow'
import WaitlistConfirmed from './pages/onboarding/WaitlistConfirmed'
import useIsMobile from './hooks/useIsMobile'
import useWaitlisted from './hooks/useWaitlisted'

// Signup only happens on mobile web — desktop only ever sees the static
// value-prop page. Once waitlisted, mobile shows the confirmation screen
// (not the live Chat app): there's no real deal data behind it yet without
// Plaid or screenshot upload (both backlogged — see BACKLOG.md), so there's
// nothing genuine to hand them into. The next thing that happens for a
// waitlisted user happens over SMS, not on this site.
function Gate() {
  const isMobile = useIsMobile()
  const [waitlisted, setWaitlisted] = useWaitlisted()

  if (!isMobile) return <DesktopLanding />
  if (!waitlisted) return <OnboardingFlow onComplete={() => setWaitlisted(true)} />
  return <WaitlistConfirmed />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Gate />} />
      <Route path="/saved" element={<Gate />} />
    </Routes>
  )
}
