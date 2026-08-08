import { useState } from 'react'
import Splash from './Splash'
import MobileLanding from './MobileLanding'
import PhoneStep from './PhoneStep'
import LocationStep from './LocationStep'
import PlaidStep from './PlaidStep'
import HandoffStep from './HandoffStep'

export default function OnboardingFlow({ onComplete }) {
  const [step, setStep] = useState('splash')

  switch (step) {
    case 'splash':
      return <Splash onDone={() => setStep('landing')} />
    case 'landing':
      return <MobileLanding onNext={() => setStep('phone')} />
    case 'phone':
      return <PhoneStep onNext={() => setStep('location')} onBack={() => setStep('landing')} />
    case 'location':
      return <LocationStep onNext={() => setStep('plaid')} />
    case 'plaid':
      return <PlaidStep onDone={() => setStep('handoff')} />
    case 'handoff':
      return <HandoffStep onDone={onComplete} />
    default:
      return null
  }
}
