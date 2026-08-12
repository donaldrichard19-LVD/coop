import { useEffect, useRef } from 'react'

// Reveals a fixed "sign up" pill once the user scrolls past the hero, so the CTA is
// always reachable on a fairly long page without following the user everywhere. Shared
// by DesktopLanding and MobileLanding — same behavior, same label, same action as each
// page's own hero button, just always in reach once you've scrolled past it.
// Per the handoff: writes directly to the DOM node via a ref instead of React state, so
// scrolling never triggers a re-render — a passive listener registered once on mount,
// which also runs immediately so a mid-page reload lands in the right state.
export default function StickyCTA({ onNext, revealAfter = 220 }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    function update() {
      const revealed = window.scrollY > revealAfter
      el.style.opacity = revealed ? '1' : '0'
      el.style.transform = revealed ? 'translateY(0)' : 'translateY(-10px)'
      el.style.pointerEvents = revealed ? 'auto' : 'none'
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [revealAfter])

  return (
    <button
      ref={ref}
      onClick={onNext}
      className="fixed top-3 right-3 z-[60] bg-tint-cta text-text-inverse rounded-capsule px-[22px] py-3 text-[16px] font-bold shadow-[0_6px_22px_rgba(0,0,0,.55)] transition-[opacity,transform] duration-[220ms] ease-out"
      style={{ opacity: 0, transform: 'translateY(-10px)', pointerEvents: 'none', fontFamily: 'Archivo, sans-serif' }}
    >
      sign up
    </button>
  )
}
