import { BrandMark } from '../components/Header'
import DealCard from '../domain/DealCard'
import { deals } from '../data/deals'

const previewDeal = deals.find((d) => d.id === 'd-bluebottle')

export default function DesktopLanding() {
  return (
    <div className="min-h-svh bg-bg-primary">
      <nav className="max-w-[1100px] mx-auto px-6 pt-6 flex items-center gap-2">
        <BrandMark size={26} />
        <span className="text-headline text-text-primary">coop</span>
      </nav>

      <div className="max-w-[1100px] mx-auto px-6 pt-14 pb-16 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-footnote font-semibold text-tint-primary tracking-wide mb-2">text it. save it.</p>
          <h1 className="text-largeTitle text-text-primary max-w-[14ch]" style={{ textWrap: 'balance' }}>
            your deal-finding friend, right in your texts.
          </h1>
          <p className="text-body text-text-secondary mt-4 max-w-[46ch]">
            Connect your bank once. Coop watches the places you actually go &mdash; coffee shops,
            lunch spots, the pizza place you always order from &mdash; and texts you the second one
            of them&rsquo;s got a deal. No new app. No hunting for codes.
          </p>

          <div className="mt-7 inline-flex items-center gap-3 bg-surface-elevated border border-separator-strong rounded-large px-5 py-4 max-w-[42ch]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-tint-primary shrink-0">
              <rect x="7" y="2" width="10" height="20" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="12" cy="18" r="0.9" fill="currentColor" />
            </svg>
            <p className="text-subheadline text-text-primary">
              coop's a texting thing &mdash; pull this up on your phone to get started.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ValueProp n="01" title="built from where you actually go">
              No browsing. No clipping coupons. Just deals from places you&rsquo;ve actually been.
            </ValueProp>
            <ValueProp n="02" title="shows up as a text">
              Deals land right in your messages &mdash; no new app, nothing to open.
            </ValueProp>
            <ValueProp n="03" title="real merchants, real relationship">
              Every deal shows how many times you&rsquo;ve been there.
            </ValueProp>
          </div>
        </div>

        <div className="max-w-[340px] mx-auto w-full">
          <DealCard deal={previewDeal} />
        </div>
      </div>
    </div>
  )
}

function ValueProp({ n, title, children }) {
  return (
    <div>
      <div className="text-caption font-semibold text-tint-primary mb-1.5">{n}</div>
      <h3 className="text-subheadline font-semibold text-text-primary mb-1">{title}</h3>
      <p className="text-footnote text-text-secondary">{children}</p>
    </div>
  )
}
