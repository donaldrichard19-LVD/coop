import { useState } from 'react'
import DesktopLanding from '../DesktopLanding'
import MobileLanding from './MobileLanding'
import WaitlistStep from './WaitlistStep'

// Simplified 2026-08-07: was splash -> landing -> phone -> location -> plaid
// -> handoff -> live chat. Then splash -> landing -> waitlist. Splash was
// dropped 2026-08-10 (mobile now opens straight to landing). The dropped
// steps (Splash/PhoneStep/LocationStep/PlaidStep/HandoffStep) aren't
// deleted, just unreferenced — see BACKLOG.md "Plaid onboarding flow" for
// why and how to bring the flow steps back.
//
// Desktop and mobile share this same landing -> waitlist state machine as of
// 2026-08-12; only the landing screen differs (DesktopLanding vs MobileLanding),
// chosen by the caller via `isMobile`.
export default function OnboardingFlow({ isMobile, onComplete }) {
  const [step, setStep] = useState('landing')

  switch (step) {
    case 'landing': {
      const Landing = isMobile ? MobileLanding : DesktopLanding
      return <Landing onNext={() => setStep('waitlist')} />
    }
    case 'waitlist':
      return <WaitlistStep onDone={onComplete} onBack={() => setStep('landing')} />
    default:
      return null
  }
}
