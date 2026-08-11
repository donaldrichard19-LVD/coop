import { useEffect, useRef } from 'react'
import { BrandMark } from '../../components/Header'
import Button from '../../components/Button'
import LandingDealDemo from '../../components/LandingDealDemo'
import ValuePropSteps from '../../components/ValuePropSteps'

// Reveals a fixed "let's go" pill once the user scrolls past the hero, so the CTA is
// always reachable on this fairly long page without following the user everywhere.
// Per the handoff: writes directly to the DOM node via a ref instead of React state, so
// scrolling never triggers a re-render — a passive listener registered once on mount,
// which also runs immediately so a mid-page reload lands in the right state.
function StickyCTA({ onNext }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    function update() {
      const revealed = window.scrollY > 220
      el.style.opacity = revealed ? '1' : '0'
      el.style.transform = revealed ? 'translateY(0)' : 'translateY(-10px)'
      el.style.pointerEvents = revealed ? 'auto' : 'none'
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  return (
    <button
      ref={ref}
      onClick={onNext}
      className="fixed top-3 right-3 z-[60] bg-tint-cta text-text-inverse rounded-capsule px-[22px] py-3 text-[16px] font-bold shadow-[0_6px_22px_rgba(0,0,0,.55)] transition-[opacity,transform] duration-[220ms] ease-out"
      style={{ opacity: 0, transform: 'translateY(-10px)', pointerEvents: 'none', fontFamily: 'Archivo, sans-serif' }}
    >
      let&rsquo;s go
    </button>
  )
}

export default function MobileLanding({ onNext }) {
  return (
    <div data-theme="dark" className="landing-dark min-h-svh bg-bg-primary flex flex-col">
      <StickyCTA onNext={onNext} />

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
          learn where you actually eat, then text you when one of them has a deal.
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
