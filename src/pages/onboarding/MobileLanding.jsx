import { BrandMark } from '../../components/Header'
import Button from '../../components/Button'
import LandingDealDemo from '../../components/LandingDealDemo'

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
          Deals you&rsquo;ll love, text it to you
        </h1>
        <p className="text-[17px] leading-[1.5] text-text-secondary mb-6">
          send Coop a screenshot of a recent order &mdash; the taco place, the coffee run, the delivery app. we
          learn where you actually eat, then text you when one of them has a deal. no new app.
        </p>

        <Button variant="primary" className="w-full justify-center py-4 text-[17px]" onClick={onNext}>
          let&rsquo;s go
        </Button>
        <p className="text-[13px] text-text-tertiary text-center mt-2.5">about a minute.</p>

        <div className="mt-10 flex flex-col gap-6">
          <Step n="01" title="send your screenshots">
            a few recent orders &mdash; local spots, delivery apps, whatever you&rsquo;ve got. that&rsquo;s the whole setup.
          </Step>
          <Step n="02" title="Coop watches your spots">
            Coop keeps an eye on the places you already order from. no browsing, no clipping.
          </Step>
          <Step n="03" title="deal is sent as a text">
            &ldquo;there&rsquo;s a deal at your taco place.&rdquo; that&rsquo;s it. keep your money.
          </Step>
        </div>

        <div className="mt-9">
          <LandingDealDemo compact />
        </div>
      </div>
    </div>
  )
}

function Step({ n, title, children }) {
  return (
    <div className="flex gap-4">
      <div className="text-[14px] font-bold font-mono text-tint-primary shrink-0 pt-0.5">{n}</div>
      <div>
        <div className="text-[17px] leading-[1.3] font-bold text-text-primary mb-1">{title}</div>
        <div className="text-[15px] leading-[1.5] text-text-secondary">{children}</div>
      </div>
    </div>
  )
}
