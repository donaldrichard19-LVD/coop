import { BrandMark } from '../../components/Header'
import Button from '../../components/Button'
import LandingDealDemo from '../../components/LandingDealDemo'
import ValuePropSteps from '../../components/ValuePropSteps'

export default function MobileLanding({ onNext }) {
  return (
    <div data-theme="dark" className="landing-dark min-h-svh bg-bg-primary flex flex-col">
      <nav className="px-5 pt-6 flex items-center gap-2">
        <BrandMark size={24} />
        <span className="text-[19px] font-extrabold tracking-[-0.03em] text-text-primary">coop</span>
      </nav>

      <div className="flex-1 px-5 pt-7 pb-10">
        <h1
          className="text-[38px] font-extrabold tracking-[-0.03em] leading-[1.1] text-text-primary mb-4"
          style={{ textWrap: 'balance' }}
        >
          Deals you&rsquo;ll love, texted to you
        </h1>
        <p className="text-[17px] leading-[1.5] text-text-secondary mb-6">
          send Coop a screenshot of a recent order &mdash; the taco place, the coffee run, the delivery app. we
          learn where you actually eat, then text you when one of them has a deal. no new app.
        </p>

        <Button variant="primary" className="w-full justify-center py-4 text-[17px]" onClick={onNext}>
          let&rsquo;s go
        </Button>

        <div className="mt-10">
          <ValuePropSteps />
        </div>

        <div className="mt-9">
          <LandingDealDemo compact />
        </div>
      </div>
    </div>
  )
}
