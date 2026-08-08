import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Chat from './pages/Chat'
import SavedDeals from './pages/SavedDeals'
import DesktopLanding from './pages/DesktopLanding'
import OnboardingFlow from './pages/onboarding/OnboardingFlow'
import useIsMobile from './hooks/useIsMobile'
import useOnboarded from './hooks/useOnboarded'

// Signup only happens on mobile web — desktop only ever sees the static
// value-prop page, regardless of onboarded state, per product requirement.
function RequireMobileOnboarding({ children }) {
  const isMobile = useIsMobile()
  const [onboarded, setOnboarded] = useOnboarded()
  const [justOnboarded, setJustOnboarded] = useState(false)

  if (!isMobile) return <DesktopLanding />

  if (!onboarded) {
    return (
      <OnboardingFlow
        onComplete={() => {
          setOnboarded(true)
          setJustOnboarded(true)
        }}
      />
    )
  }

  return children(justOnboarded)
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={<RequireMobileOnboarding>{(justOnboarded) => <Chat startWithOffers={justOnboarded} />}</RequireMobileOnboarding>}
      />
      <Route path="/saved" element={<RequireMobileOnboarding>{() => <SavedDeals />}</RequireMobileOnboarding>} />
    </Routes>
  )
}
