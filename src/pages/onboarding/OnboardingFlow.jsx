import { useState } from 'react'
import MobileLanding from './MobileLanding'
import WaitlistStep from './WaitlistStep'

// Simplified 2026-08-07: was splash -> landing -> phone -> location -> plaid
// -> handoff -> live chat. Then splash -> landing -> waitlist. Splash was
// dropped 2026-08-10 (mobile now opens straight to landing). The dropped
// steps (Splash/PhoneStep/LocationStep/PlaidStep/HandoffStep) aren't
// deleted, just unreferenced — see BACKLOG.md "Plaid onboarding flow" for
// why and how to bring the flow steps back.
export default function OnboardingFlow({ onComplete }) {
  const [step, setStep] = useState('landing')

  switch (step) {
    case 'landing':
      return <MobileLanding onNext={() => setStep('waitlist')} />
    case 'waitlist':
      return <WaitlistStep onDone={onComplete} onBack={() => setStep('landing')} />
    default:
      return null
  }
}
