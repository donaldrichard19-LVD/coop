import { Link } from 'react-router-dom'
import { BrandMark } from '../components/Header'
import Button from '../components/Button'
import LandingDealDemo from '../components/LandingDealDemo'
import ValuePropSteps from '../components/ValuePropSteps'

// Desktop now shares the same signup entry point as mobile (onNext -> WaitlistStep,
// wired up in OnboardingFlow) — this used to be a static, CTA-less page per an earlier
// design handoff, but that constraint's gone. See App.jsx's Gate.
export default function DesktopLanding({ onNext }) {
  return (
    <div data-theme="dark" className="landing-dark min-h-svh bg-bg-primary px-14 pt-10 pb-[72px]">
      <nav className="flex items-center gap-3 mb-24">
        <BrandMark size={28} />
        <span className="text-[26px] font-extrabold tracking-[-0.03em] text-text-primary">coop</span>
      </nav>

      <div className="grid grid-cols-1 min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(0,0.78fr)] gap-24 items-start max-w-[1560px]">
        <div>
          <p className="text-[17px] font-bold text-tint-primary tracking-[-0.01em] mb-[26px]">text it. save it.</p>
          <h1
            className="text-[68px] font-extrabold tracking-[-0.035em] leading-[1.06] text-text-primary mb-[30px]"
            style={{ textWrap: 'balance' }}
          >
            Deals you&rsquo;ll love, texted to you
          </h1>
          <p
            className="text-[22px] leading-[1.55] text-text-secondary max-w-[620px] mb-[34px]"
            style={{ textWrap: 'pretty' }}
          >
            send Coop a screenshot of a recent order &mdash; the taco place, the coffee run, the delivery app. we
            learn where you actually eat, then text you when one of them has a deal.
          </p>

          <div className="flex items-center gap-5 mb-12">
            <Button variant="primary" className="px-9 py-4 text-[18px]" onClick={onNext}>
              sign up
            </Button>
            <p className="text-[15px] text-text-tertiary">takes 10 seconds &mdash; we just need a number to text.</p>
          </div>
        </div>

        <LandingDealDemo />
      </div>

      <div className="max-w-[1560px] mt-[clamp(56px,9vw,104px)]">
        <ValuePropSteps />
      </div>

      <footer className="max-w-[1560px] flex items-center gap-5 mt-16 pt-6 border-t border-separator-subtle text-[14px] text-text-tertiary">
        <span>&copy; {new Date().getFullYear()} Coop</span>
        <Link to="/privacy" className="hover:text-text-secondary transition-colors">Privacy</Link>
        <Link to="/terms" className="hover:text-text-secondary transition-colors">Terms</Link>
      </footer>
    </div>
  )
}
