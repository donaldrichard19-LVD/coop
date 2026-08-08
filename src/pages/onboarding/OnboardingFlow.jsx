import { useState } from 'react'
import Splash from './Splash'
import MobileLanding from './MobileLanding'
import WaitlistStep from './WaitlistStep'

// Simplified 2026-08-07: was splash -> landing -> phone -> location -> plaid
// -> handoff -> live chat. Now splash -> landing -> waitlist. The dropped
// steps (PhoneStep/LocationStep/PlaidStep/HandoffStep) aren't deleted, just
// unreferenced — see BACKLOG.md "Plaid onboarding flow" for why and how to
// bring them back.
export default function OnboardingFlow({ onComplete }) {
  const [step, setStep] = useState('splash')

  switch (step) {
    case 'splash':
      return <Splash onDone={() => setStep('landing')} />
    case 'landing':
      return <MobileLanding onNext={() => setStep('waitlist')} />
    case 'waitlist':
      return <WaitlistStep onDone={onComplete} onBack={() => setStep('landing')} />
    default:
      return null
  }
}
