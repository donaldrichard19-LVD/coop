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
    setTimeout(onDone, reduceMotion ? 0 : 500)
  }

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = setTimeout(leave, reduceMotion ? 900 : 2400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <button
      onClick={leave}
      className={`min-h-svh w-full flex flex-col items-center justify-center gap-5 bg-bg-primary transition-opacity duration-500 motion-reduce:transition-none ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <img
        src="/brand/coop-mark-animated.svg"
        alt="coop"
        className="h-[22vh] max-h-[160px] w-auto animate-splash-in motion-reduce:animate-none"
      />
      <div
        className="text-subheadline font-semibold text-text-tertiary animate-splash-fade motion-reduce:animate-none motion-reduce:opacity-100"
        style={{ animationDelay: '400ms' }}
      >
        coop
      </div>
      <div
        className="text-caption font-mono text-text-tertiary animate-splash-fade motion-reduce:animate-none motion-reduce:opacity-70"
        style={{ animationDelay: '1400ms' }}
      >
        tap to continue
      </div>
    </button>
  )
}
