import { useEffect, useState } from 'react'

const STEPS = ['Looking at where you shop', 'Finding your regulars', 'Checking today’s deals', 'Sending your first text…']

export default function HandoffStep({ onDone }) {
  const [done, setDone] = useState(-1)

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const delay = reduceMotion ? 0 : 420
    const timers = STEPS.map((_, i) => setTimeout(() => setDone(i), i * delay + delay))
    const finish = setTimeout(onDone, STEPS.length * delay + delay + 250)
    return () => {
      timers.forEach(clearTimeout)
      clearTimeout(finish)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-svh bg-bg-primary flex items-center justify-center px-5">
      <div className="w-full max-w-[380px] bg-surface-elevated border border-separator-subtle rounded-large p-7 text-center">
        <div
          className="w-9 h-9 mx-auto mb-5 rounded-full border-[3px] border-separator-subtle motion-reduce:animate-none"
          style={{ borderTopColor: 'var(--tint-primary)', animation: 'coop-handoff-spin 0.9s linear infinite' }}
        />
        <h2 className="text-title2 text-text-primary mb-1.5">Reading your last 6 months</h2>
        <p className="text-subheadline text-text-secondary mb-5">Matching your regulars against today&rsquo;s deals. Usually instant.</p>
        <div className="flex flex-col gap-2 text-left max-w-[260px] mx-auto font-mono text-caption">
          {STEPS.map((label, i) => (
            <div key={label} className={i <= done ? 'text-text-primary' : 'text-text-tertiary'}>
              {i <= done ? '✓' : '·'} {label}
            </div>
          ))}
        </div>
      </div>
      <style>{'@keyframes coop-handoff-spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  )
}
