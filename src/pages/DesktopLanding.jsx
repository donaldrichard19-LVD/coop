import { BrandMark } from '../components/Header'
import LandingDealDemo from '../components/LandingDealDemo'

// Desktop never gets a signup CTA — per the design handoff there isn't one
// here at all, only the "pull this up on your phone" note. That's what
// keeps the signup flow (WaitlistStep) mobile-only; see App.jsx's Gate.
export default function DesktopLanding() {
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
            Deals you&rsquo;ll love, text it to you
          </h1>
          <p
            className="text-[22px] leading-[1.55] text-text-secondary max-w-[620px] mb-[34px]"
            style={{ textWrap: 'pretty' }}
          >
            send Coop a screenshot of a recent order &mdash; the taco place, the coffee run, the delivery app. we
            learn where you actually eat, then text you when one of them has a deal. no new app.
          </p>

          <div className="flex items-center gap-4 bg-surface-elevated rounded-[22px] px-[26px] py-[22px] max-w-[620px] mb-12">
            <svg viewBox="0 0 24 24" width="22" height="22" className="shrink-0" fill="none" stroke="#19A877" strokeWidth="1.7">
              <rect x="6" y="2" width="12" height="20" rx="3" />
              <line x1="10.5" y1="18.5" x2="13.5" y2="18.5" />
            </svg>
            <p className="text-[19px] leading-[1.45] font-medium text-[rgba(245,242,234,.8)]">
              Coop&rsquo;s a texting thing &mdash; pull this up on your phone to get started.
            </p>
          </div>

          <div className="grid grid-cols-1 min-[560px]:grid-cols-3 gap-10 max-w-[780px]">
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
        </div>

        <LandingDealDemo />
      </div>
    </div>
  )
}

function Step({ n, title, children }) {
  return (
    <div>
      <div className="text-[15px] font-bold font-mono text-tint-primary mb-3.5">{n}</div>
      <div className="text-[20px] leading-[1.3] font-bold text-text-primary mb-2.5">{title}</div>
      <div className="text-[16px] leading-[1.5] text-text-secondary">{children}</div>
    </div>
  )
}
