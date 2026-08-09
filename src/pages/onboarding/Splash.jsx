import { useEffect, useRef, useState } from 'react'

// The scan-line animation is baked into the SVG itself (self-contained CSS
// @keyframes + its own prefers-reduced-motion query) — this is the one
// place in the whole app that asset is allowed to appear, per brand spec.
export default function Splash({ onDone }) {
  const [leaving, setLeaving] = useState(false)
  const firedRef = useRef(false)

  function leave() {
    if (firedRef.current) return
    firedRef.current = true
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setLeaving(true)
    setTimeout(onDone, reduceMotion ? 0 : 900)
  }

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = setTimeout(leave, reduceMotion ? 900 : 3600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <button
      onClick={leave}
      className={`min-h-svh w-full flex flex-col items-center justify-center gap-5 bg-bg-primary transition-opacity duration-[900ms] motion-reduce:transition-none ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <img
        src="/brand/coop-mark-animated.svg"
        alt="Coop"
        className="h-[22vh] max-h-[160px] w-auto animate-splash-in motion-reduce:animate-none"
      />
      <div
        className="text-[56px] font-extrabold tracking-[-0.03em] text-text-primary animate-splash-fade motion-reduce:animate-none motion-reduce:opacity-100"
        style={{ animationDelay: '400ms' }}
      >
        Coop
      </div>
      <div
        className="text-footnote font-semibold text-tint-primary animate-splash-fade motion-reduce:animate-none motion-reduce:opacity-100"
        style={{ animationDelay: '900ms' }}
      >
        text it. save it.
      </div>
    </button>
  )
}
