import { useState } from 'react'
import Button from './Button'

const MAP_SRC = '/landing/map-taqueria-sol.png'

// Locked marketing demo from the landing-page design handoff — a
// self-contained deal/saved/map state machine with static Taqueria Sol
// content, distinct from the real DealCard (used in Chat.jsx) which is
// driven by live merchant data. Reuses Button for the pill CTAs; the rest
// is hand-matched to spec pixel values via the .landing-dark token overrides.
export default function LandingDealDemo({ compact = false }) {
  const [view, setView] = useState('deal')
  const [copied, setCopied] = useState(false)

  function go(next) {
    setView(next)
    setCopied(false)
  }

  function copy() {
    navigator.clipboard?.writeText('SOL-QUESO').catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="bg-surface-elevated rounded-[26px] px-6 py-[22px] flex items-center gap-[18px]">
        <div className="w-[54px] h-[68px] rounded-[10px] bg-gradient-to-b from-[#2E2E32] to-[#232326] border border-[rgba(245,242,234,.12)] shrink-0 flex flex-col gap-[5px] px-2 py-[9px] box-border">
          <span className="h-[5px] rounded-full bg-[rgba(245,242,234,.34)] w-4/5" />
          <span className="h-[5px] rounded-full bg-[rgba(245,242,234,.2)] w-3/5" />
          <span className="h-[5px] rounded-full bg-[rgba(245,242,234,.2)] w-[70%]" />
          <span className="mt-auto h-[6px] rounded-full bg-tint-primary w-1/2" />
        </div>
        <div className="min-w-0">
          <div className="text-[17px] font-bold text-text-primary mb-1.5">screenshot received</div>
          <div className="text-[15px] leading-[1.45] text-text-secondary">
            taqueria sol &middot; $23.40 &middot; tuesday. got it &mdash; i&rsquo;ll watch this one.
          </div>
        </div>
      </div>

      <div className="bg-surface-elevated rounded-[30px] px-9 py-[34px]">
        <div className="flex items-center gap-4 mb-7">
          <div className="w-[52px] h-[52px] rounded-full bg-[#2E2E32] flex items-center justify-center text-[17px] font-bold text-text-secondary shrink-0">
            TS
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-[22px] font-bold text-text-primary">Taqueria Sol</div>
              <span className="text-[12px] font-bold font-mono tracking-[0.09em] uppercase text-[rgba(245,242,234,.75)] bg-[#2E2E32] rounded-full px-3 py-[5px]">
                regular
              </span>
            </div>
            <div className="text-[15px] text-text-tertiary mt-1">4 orders you&rsquo;ve sent us &middot; 0.3 mi</div>
          </div>
        </div>

        {view === 'deal' && (
          <div>
            <div className="text-[27px] leading-[1.25] font-bold tracking-[-0.02em] text-text-primary mb-5">
              free chips + queso with any burrito
            </div>
            <div className="text-[20px] font-bold text-text-primary mb-[18px]">you save ~$6.50</div>
            <div className="flex items-center gap-2.5 mb-[30px]">
              <span className="w-2 h-2 rounded-full bg-warning shrink-0" />
              <span className="text-[16px] text-text-secondary">ends sunday</span>
            </div>
            <div className="flex gap-3.5">
              <Button variant="primary" className="flex-1 py-[18px] text-[18px] rounded-full" onClick={() => go('saved')}>
                save it
              </Button>
              <Button variant="outline" className="flex-1 py-[18px] text-[18px] rounded-full" onClick={() => go('map')}>
                directions
              </Button>
            </div>
          </div>
        )}

        {view === 'saved' && (
          <div className="animate-rise-in">
            <div className="flex items-center gap-4 mb-[22px]">
              <CheckBurst />
              <div className="text-[26px] font-bold tracking-[-0.02em] text-text-primary">saved.</div>
            </div>
            <p className="text-[17px] leading-[1.5] text-text-secondary mb-[22px]">
              code&rsquo;s in your texts too. show it at the counter.
            </p>
            <div className="flex items-center justify-between gap-3.5 border-[1.5px] border-dashed border-[rgba(25,168,119,.55)] rounded-[18px] px-6 py-5 mb-[26px]">
              <span className="text-[26px] font-bold font-mono tracking-[0.1em] text-tint-primary">SOL-QUESO</span>
              <button onClick={copy} className="text-[15px] font-bold text-text-secondary px-1.5 py-1.5 shrink-0">
                {copied ? 'copied' : 'copy'}
              </button>
            </div>
            <div className="flex gap-3.5 items-center">
              <Button variant="primary" className="flex-1 py-[18px] text-[18px] rounded-full" onClick={() => go('map')}>
                directions
              </Button>
              <button onClick={() => go('deal')} className="text-[17px] font-bold text-text-secondary px-3 py-[18px] shrink-0">
                back
              </button>
            </div>
          </div>
        )}

        {view === 'map' && (
          <div className="animate-rise-in">
            <div className="h-[250px] rounded-[20px] overflow-hidden mb-[22px]">
              <img
                src={MAP_SRC}
                alt="Walking directions from Dolores Park to Taqueria Sol"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex items-baseline gap-3 mb-2 flex-wrap">
              <div className="text-[24px] font-bold tracking-[-0.02em] text-text-primary">6 min walk</div>
              <div className="text-[16px] text-text-tertiary">0.3 mi &middot; open till 10</div>
            </div>
            <p className="text-[16px] leading-[1.5] text-text-secondary mb-[26px]">
              414 mission st. i&rsquo;ll text you the code when you get close.
            </p>
            <div className="flex gap-3.5 items-center">
              <Button
                variant="primary"
                className="flex-1 py-[18px] text-[18px] rounded-full"
                onClick={() => window.open('https://www.google.com/maps/search/taqueria+sol', '_blank', 'noopener')}
              >
                open in maps
              </Button>
              <button onClick={() => go('deal')} className="text-[17px] font-bold text-text-secondary px-3 py-[18px] shrink-0">
                back
              </button>
            </div>
          </div>
        )}
      </div>

      {!compact && (
        <p className="text-[15px] leading-[1.5] text-text-tertiary px-1.5">
          no bank connection. no card linking. just the screenshots you send.
        </p>
      )}
    </div>
  )
}

function CheckBurst() {
  return (
    <div className="relative w-[46px] h-[46px] shrink-0">
      <div className="absolute inset-0 rounded-full bg-tint-primary animate-[coopPing_0.9s_ease-out_0.15s_both]" />
      <div className="absolute inset-0 rounded-full bg-[#0E7C57] flex items-center justify-center animate-[coopPop_0.45s_cubic-bezier(0.2,0.8,0.3,1)_both]">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#F5F2EA" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M5 12.5 L10 17.5 L19 7"
            strokeDasharray="26"
            strokeDashoffset="26"
            className="animate-[coopDraw_0.38s_ease-out_0.22s_forwards]"
          />
        </svg>
      </div>
    </div>
  )
}
