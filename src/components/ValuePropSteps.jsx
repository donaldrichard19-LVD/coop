import { BrandMark } from './Header'

// The three value-prop illustration panels + copy, from the landing-page design
// handoff's "2. Value-prop section". Previously this section was copy-only (no
// illustration) on both DesktopLanding.jsx and MobileLanding.jsx — this is the one
// genuinely new/missing piece from that handoff (the rest of the landing page already
// matched it). Single shared component using an auto-fit CSS grid (no JS device split,
// no media query) so it reflows 3-column -> 1-column on its own, per the handoff's
// "fluid, no breakpoints" spec — replaces the separate hand-duplicated Step markup that
// used to live in each page.
//
// All three loops share one 7s cycle so the row breathes together; percentages in the
// keyframes (src/index.css, prefixed c*) are of that 7s. Decorative only — aria-hidden,
// the adjacent copy carries the meaning. Reduced motion is handled by the existing
// global prefers-reduced-motion rule in index.css (no per-panel override needed).

const PANEL_CLASS =
  'relative bg-[#0B0B0C] border border-[rgba(245,242,234,.08)] rounded-[26px] h-[clamp(300px,30vw,340px)] p-[22px] box-border overflow-hidden mb-[26px]'

export default function ValuePropSteps() {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-[clamp(32px,4vw,56px)] items-start">
      <Step n="01" title="send your screenshots" illustration={<ScreenshotsLoop />}>
        a few recent orders &mdash; local spots, delivery apps, whatever you&rsquo;ve got. that&rsquo;s the whole
        setup.
      </Step>
      <Step n="02" title="Coop watches your spots" illustration={<SpotsLoop />}>
        Coop keeps an eye on the places you already order from. no browsing, no clipping.
      </Step>
      <Step n="03" title="you get deals, personalized to you" illustration={<DealTextLoop />}>
        &ldquo;there&rsquo;s a deal at your taco place.&rdquo; that&rsquo;s it. keep your money.
      </Step>
    </div>
  )
}

function Step({ n, title, illustration, children }) {
  return (
    <div>
      {illustration}
      <div className="text-[15px] font-bold font-mono text-tint-primary mb-3.5">{n}</div>
      <div className="text-[clamp(20px,2.4vw,24px)] leading-[1.25] font-bold tracking-[-0.02em] text-text-primary mb-2.5">
        {title}
      </div>
      <div className="text-[16px] leading-[1.5] text-text-secondary max-w-[42ch]" style={{ textWrap: 'pretty' }}>
        {children}
      </div>
    </div>
  )
}

function ReceiptTile({ delay, bars, fillLast }) {
  return (
    <div
      className="w-[clamp(52px,16%,62px)] aspect-[62/82] rounded-[11px] bg-[#F5F2EA] p-[9px] box-border flex flex-col gap-[5px]"
      style={{ animation: `cTile 7s ease-out ${delay} infinite` }}
    >
      {bars.map((w, i) => (
        <div
          key={i}
          className="rounded-[3px]"
          style={{
            width: w,
            height: i === 0 ? '6px' : '5px',
            background: i === 0 ? 'rgba(17,17,18,.7)' : 'rgba(17,17,18,.18)',
          }}
        />
      ))}
      {fillLast && <div className="mt-auto h-[8px] rounded-[3px] bg-[#0E7C57]" style={{ width: fillLast }} />}
    </div>
  )
}

function ReplyAvatar() {
  return (
    <div className="relative w-[34px] h-[29.4px] shrink-0">
      <BrandMark size={29.4} />
    </div>
  )
}

function ScreenshotsLoop() {
  return (
    <div aria-hidden="true" className={`${PANEL_CLASS} flex flex-col justify-end gap-[14px]`}>
      <div
        className="self-end max-w-[92%] bg-[#0E7C57] rounded-[22px_22px_8px_22px] p-[13px]"
        style={{ animation: 'cBubbleOut 7s ease-in-out infinite' }}
      >
        <div className="flex gap-2">
          <ReceiptTile delay="0.1s" bars={['70%', '100%', '85%']} fillLast="52%" />
          <ReceiptTile delay="0.35s" bars={['55%', '92%', '74%']} fillLast="60%" />
          <ReceiptTile delay="0.6s" bars={['64%', '88%', '66%']} fillLast="44%" />
        </div>
        <div className="mt-[11px] text-[15px] leading-[1.4] font-medium text-[rgba(245,242,234,.92)]">
          my last few orders
        </div>
      </div>
      <div className="flex items-end gap-2.5" style={{ animation: 'cReply 7s ease-out infinite' }}>
        <ReplyAvatar />
        <div className="bg-[#2C2C2E] rounded-[22px_22px_22px_8px] px-4 py-3 text-[15px] leading-[1.4] font-medium text-text-primary">
          got you. watching all 3.
        </div>
      </div>
    </div>
  )
}

function SpotRow({ name, meta, lit, chipDelay, pulseDelay }) {
  return (
    <div
      className="flex items-center gap-3.5 rounded-[18px] px-[15px] py-[13px]"
      style={
        lit
          ? { border: '1px solid rgba(25,168,119,.55)', animation: 'cLit 7s ease-in-out infinite' }
          : { background: '#141416', border: '1px solid rgba(245,242,234,.07)' }
      }
    >
      <div className="relative w-2.5 h-2.5 shrink-0">
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: lit ? '#19A877' : 'rgba(245,242,234,.3)' }}
        />
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: `1.5px solid ${lit ? 'rgba(25,168,119,.7)' : 'rgba(245,242,234,.35)'}`,
            animation: `cPulse 2.6s ease-out ${pulseDelay} infinite`,
          }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-bold text-text-primary whitespace-nowrap overflow-hidden text-ellipsis">
          {name}
        </div>
        <div className="text-[13px] text-[rgba(245,242,234,.42)]">{meta}</div>
      </div>
      {lit && (
        <div
          className="shrink-0 text-[11px] font-bold font-mono tracking-[0.08em] text-[#0B0B0C] bg-[#19A877] rounded-full px-2.5 py-[5px]"
          style={{ animation: `cChip 7s ease-out ${chipDelay} infinite` }}
        >
          DEAL
        </div>
      )}
    </div>
  )
}

function SpotsLoop() {
  return (
    <div aria-hidden="true" className={PANEL_CLASS}>
      <div className="absolute left-[22px] right-[22px] top-1/2 -translate-y-1/2 h-[196px] overflow-hidden">
        <div
          className="absolute left-0 right-0 top-0 h-[2px] z-[3]"
          style={{
            background: 'rgba(25,168,119,.9)',
            boxShadow: '0 0 22px 4px rgba(25,168,119,.75)',
            animation: 'cScan 7s cubic-bezier(.5,0,.3,1) infinite',
          }}
        />
        <div className="flex flex-col gap-[11px]">
          <SpotRow name="Blue Bottle" meta="6 orders · 0.2 mi" pulseDelay="0s" />
          <SpotRow name="Taqueria Sol" meta="4 orders · 0.3 mi" lit pulseDelay="0.5s" chipDelay="0s" />
          <SpotRow name="Nam Vietnamese" meta="3 orders · 1.1 mi" pulseDelay="1s" />
        </div>
      </div>
    </div>
  )
}

function TypingBubble() {
  return (
    <div className="absolute top-0 left-0 flex items-end gap-2.5" style={{ animation: 'cTyping 7s steps(1,end) infinite' }}>
      <ReplyAvatar />
      <div className="bg-[#2C2C2E] rounded-[22px_22px_22px_8px] px-[19px] py-[17px] flex items-center gap-[7px]">
        {[0, 0.15, 0.3].map((d) => (
          <div
            key={d}
            className="w-2 h-2 rounded-full bg-[#A8A8AC]"
            style={{ animation: `cDot 1.1s ease-in-out ${d}s infinite` }}
          />
        ))}
      </div>
    </div>
  )
}

function DealTextLoop() {
  return (
    <div aria-hidden="true" className={PANEL_CLASS}>
      <div className="absolute left-[22px] right-[22px] top-[46px] h-[240px]">
        <TypingBubble />
        <div
          className="absolute top-0 left-0 right-0 flex items-end gap-2.5"
          style={{ animation: 'cMsg 7s ease-out infinite' }}
        >
          <ReplyAvatar />
          <div className="bg-[#2C2C2E] rounded-[22px_22px_22px_8px] px-[17px] py-[13px] text-[16px] leading-[1.35] font-medium max-w-[84%] text-text-primary">
            there&rsquo;s a deal at Taqueria Sol.
          </div>
        </div>
        <div
          className="absolute top-[104px] left-[44px] flex items-center gap-[13px]"
          style={{ animation: 'cPrice 7s ease-out infinite' }}
        >
          <div
            className="relative font-bold text-[clamp(24px,2.6vw,28px)] tracking-[-0.02em]"
            style={{ color: 'rgba(245,242,234,.4)' }}
          >
            $23.40
            <div
              className="absolute left-[-2px] right-[-2px] top-1/2 h-[3px] rounded-[2px] origin-left"
              style={{ background: 'rgba(245,242,234,.55)', animation: 'cStrike 7s cubic-bezier(.5,0,.3,1) infinite' }}
            />
          </div>
          <div className="font-bold text-[clamp(27px,3vw,32px)] tracking-[-0.02em] text-tint-primary">$16.90</div>
        </div>
        <div
          className="absolute top-[168px] left-[44px] inline-flex items-center rounded-full px-[18px] py-[11px]"
          style={{
            background: 'rgba(25,168,119,.13)',
            border: '1px solid rgba(25,168,119,.45)',
            animation: 'cKeep 7s ease-out infinite',
          }}
        >
          <div className="font-bold text-[17px] text-text-primary">keep the $6.50</div>
        </div>
      </div>
    </div>
  )
}
