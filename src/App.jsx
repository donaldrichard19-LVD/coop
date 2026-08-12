import { Routes, Route } from 'react-router-dom'
import OnboardingFlow from './pages/onboarding/OnboardingFlow'
import WaitlistConfirmed from './pages/onboarding/WaitlistConfirmed'
import Privacy from './pages/legal/Privacy'
import Terms from './pages/legal/Terms'
import useIsMobile from './hooks/useIsMobile'
import useWaitlisted from './hooks/useWaitlisted'

// Desktop and mobile both get the signup flow (landing -> waitlist), just with
// different landing screens — see OnboardingFlow. Once waitlisted, both show the
// confirmation screen (not the live Chat app): there's no real deal data behind
// it yet without Plaid or screenshot upload (both backlogged — see BACKLOG.md),
// so there's nothing genuine to hand them into. The next thing that happens for
// a waitlisted user happens over SMS, not on this site.
function Gate() {
  const isMobile = useIsMobile()
  const [waitlisted, setWaitlisted] = useWaitlisted()

  if (!waitlisted) return <OnboardingFlow isMobile={isMobile} onComplete={() => setWaitlisted(true)} />
  return <WaitlistConfirmed />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Gate />} />
      <Route path="/saved" element={<Gate />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
    </Routes>
  )
}
