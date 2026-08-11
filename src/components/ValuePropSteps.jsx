import { BrandMark } from './Header'

// The three value-prop illustration panels + copy, from the landing-page design
// handoff's "2. Value-prop section" — 2026-08-11 revision. Previous version (still in
// git history) used generic Coop-branded chat bubbles; this revision restyles the
// panels as literal iMessage thread simulations (system UI font, iOS bubble grouping,
// a real chat header) so they read as an actual screenshot of texting Coop, not a
// branded illustration. Single shared component using an auto-fit CSS grid (no JS
// device split, no media query) so it reflows 3-column -> 1-column on its own, per the
// handoff's "fluid, no breakpoints" spec.
//
// Deliberately NOT reverted despite this handoff's own copy: the hero H1, the "no new
// app"/"no bank" phrasing, and "no browsing, no clipping" were all removed in earlier,
// more specific content passes and stay removed here — confirmed with the user, who
// flagged these three exceptions explicitly rather than have the whole page silently
// regress to the handoff's copy.
//
// All three loops share one 7s cycle so the row breathes together; percentages in the
// keyframes (src/index.css, prefixed c*/p*) are of that 7s. Decorative only —
// aria-hidden, the adjacent copy carries the meaning. Reduced motion is handled by the
// existing global prefers-reduced-motion rule in index.css (no per-panel override
// needed).

const PANEL_CLASS =
  'relative bg-black border border-[rgba(84,84,88,.65)] rounded-[24px] h-[clamp(340px,34vw,380px)] overflow-hidden mb-[26px] flex flex-col'
const SYSTEM_FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif"

export default function ValuePropSteps() {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-[clamp(32px,4vw,56px)] items-start">
      <Step n="step 1" title="send your screenshots" illustration={<ScreenshotsThread />}>
        a few recent orders &mdash; local spots, delivery apps, whatever you&rsquo;ve got. that&rsquo;s the whole
        setup.
      </Step>
      <Step n="step 2" title="Coop watches your spots" illustration={<WatchingThread />}>
        Coop keeps an eye on the places you already order from.
      </Step>
      <Step n="step 3" title="you get 🔥 deals, personalized to you" illustration={<DealThread />}>
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

function ChatHeader() {
  return (
    <div
      className="shrink-0 bg-[#1c1c1e] border-b border-[rgba(84,84,88,.55)] px-3 pt-2 pb-2.5 flex items-center"
      style={{ fontFamily: SYSTEM_FONT }}
    >
      <svg
        className="w-[18px] h-[18px] shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#0A84FF"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
      <div className="flex-1 flex flex-col items-center">
        <div className="w-[34px] h-[34px] rounded-full bg-[#0E7C57] flex items-center justify-center">
          <BrandMark size={19} />
        </div>
        <div className="flex items-center gap-[2px] mt-[3px]">
          <span className="text-[11px] leading-[14px] text-[rgba(235,235,245,.6)]">coop</span>
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(235,235,245,.4)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
      <div className="w-[22px] shrink-0" />
    </div>
  )
}

function DateStamp({ children }) {
  return (
    <div
      className="text-center text-[11px] leading-[14px] font-semibold text-[rgba(235,235,245,.35)] pt-2 pb-1"
      style={{ fontFamily: SYSTEM_FONT }}
    >
      {children}
    </div>
  )
}

function Bubble({ mine, radius, animation, className = '', style, children }) {
  return (
    <div
      className={`w-fit px-3.5 py-2.5 text-[17px] leading-[22px] ${
        mine ? 'self-end bg-[#0A84FF] text-white max-w-[78%]' : 'self-start bg-[#3b3b3d] text-white max-w-[86%]'
      } ${className}`}
      style={{ fontFamily: SYSTEM_FONT, borderRadius: radius ?? '20px', animation, opacity: 0, ...style }}
    >
      {children}
    </div>
  )
}

function ReceiptTile({ delay, bars, fillLast }) {
  return (
    <div
      className="w-[50px] aspect-[50/66] rounded-[8px] bg-[#f2f2f7] p-[7px] box-border flex flex-col gap-[4px]"
      style={{ animation: `cTile 7s ease-out ${delay} infinite` }}
    >
      {bars.map((w, i) => (
        <div
          key={i}
          className="rounded-[2px]"
          style={{
            width: w,
            height: i === 0 ? '5px' : '4px',
            background: i === 0 ? 'rgba(17,17,18,.7)' : 'rgba(17,17,18,.18)',
          }}
        />
      ))}
      {fillLast && <div className="mt-auto h-[6px] rounded-[2px] bg-[#0E7C57]" style={{ width: fillLast }} />}
    </div>
  )
}

function TypingDots({ animation }) {
  return (
    <Bubble mine={false} radius="20px 20px 20px 6px" animation={animation}>
      <div className="flex items-center gap-[6px] py-[3px]">
        {[0, 0.15, 0.3].map((d) => (
          <div
            key={d}
            className="w-[7px] h-[7px] rounded-full bg-[#a8a8ac]"
            style={{ animation: `cDot 1.1s ease-in-out ${d}s infinite` }}
          />
        ))}
      </div>
    </Bubble>
  )
}

// 01 — screenshots land in an outgoing bubble, coop types then replies. The typing dots
// and the reply share the same absolutely-positioned slot (per the handoff) so the swap
// doesn't shift the layout above it.
function ScreenshotsThread() {
  return (
    <div aria-hidden="true" className={PANEL_CLASS}>
      <ChatHeader />
      <div className="flex-1 flex flex-col justify-end gap-[7px] px-3 pb-3 pt-2 overflow-hidden">
        <DateStamp>Text Message &middot; Today 6:41 PM</DateStamp>
        <div
          className="self-end max-w-[80%] bg-[#0A84FF] rounded-[20px] p-[11px]"
          style={{ animation: 'cBubbleOut 7s ease-in-out infinite', opacity: 0 }}
        >
          <div className="flex gap-[6px]">
            <ReceiptTile delay="0.1s" bars={['70%', '100%', '85%']} fillLast="52%" />
            <ReceiptTile delay="0.3s" bars={['55%', '92%', '74%']} fillLast="60%" />
            <ReceiptTile delay="0.5s" bars={['64%', '88%', '66%']} fillLast="44%" />
          </div>
          <div className="mt-[8px] text-[15px] leading-[20px] text-white" style={{ fontFamily: SYSTEM_FONT }}>
            my last few orders
          </div>
        </div>
        <div className="relative min-h-[38px]">
          <div className="absolute inset-0">
            <TypingDots animation="cTyping 7s steps(1,end) infinite" />
          </div>
          <div className="absolute inset-0">
            <Bubble mine={false} radius="20px 20px 20px 6px" animation="pReply 7s ease-out infinite">
              got you. watching all 3.
            </Bubble>
          </div>
        </div>
      </div>
    </div>
  )
}

// 02 — coop confirms what it's watching. Four messages accumulate in the thread on a
// shared cadence (pMsg1-4); the column is bottom-anchored (justify-content: flex-end)
// so earlier, still-invisible messages occupy real layout space above the fold and get
// clipped by overflow:hidden until their turn — matches the handoff's warning that this
// panel is height-critical.
function WatchingThread() {
  return (
    <div aria-hidden="true" className={PANEL_CLASS}>
      <ChatHeader />
      <div className="flex-1 flex flex-col justify-end gap-[7px] px-3 pb-3 pt-2 overflow-hidden">
        <Bubble mine={false} radius="20px 20px 20px 6px" animation="pMsg1 7s ease-out infinite">
          got your spots. i&rsquo;m watching 6.
        </Bubble>
        <Bubble mine={false} radius="6px 20px 20px 6px" animation="pMsg2 7s ease-out infinite" className="mt-[1px]">
          Blue Bottle, Tony&rsquo;s Pizza, Chipotle + 3 more
        </Bubble>
        <Bubble mine={false} radius="6px 20px 20px 20px" animation="pMsg3 7s ease-out infinite" className="mt-[1px]">
          no app to check. i&rsquo;ll text you when something&rsquo;s worth it.
        </Bubble>
        <Bubble mine radius="20px" animation="pMsg4 7s ease-out infinite" className="mt-[7px]">
          perfect
        </Bubble>
      </div>
    </div>
  )
}

// 03 — the deal arrives as a text. Same accumulating-thread pattern as WatchingThread;
// the third slot is a link-preview-style card rather than a plain bubble.
function DealThread() {
  return (
    <div aria-hidden="true" className={PANEL_CLASS}>
      <ChatHeader />
      <div className="flex-1 flex flex-col justify-end gap-[7px] px-3 pb-3 pt-2 overflow-hidden">
        <Bubble mine={false} radius="20px 20px 20px 6px" animation="pMsg1 7s ease-out infinite">
          15% off at Taqueria Sol tonight 🌮
        </Bubble>
        <Bubble mine={false} radius="6px 20px 20px 20px" animation="pMsg2 7s ease-out infinite" className="mt-[1px]">
          that&rsquo;s ~$6.50 back on your usual order. ends sunday.
        </Bubble>
        <div
          className="self-start max-w-[86%] bg-[#3b3b3d] rounded-[6px_20px_20px_20px] overflow-hidden"
          style={{ animation: 'pMsg3 7s ease-out infinite', opacity: 0 }}
        >
          <div
            className="h-[52px] flex items-center justify-center"
            style={{ background: 'linear-gradient(140deg,#0E7C57,#0a5c41)' }}
          >
            <span className="font-mono font-semibold text-[16px] tracking-[0.08em] text-white">SOL-QUESO</span>
          </div>
          <div className="px-3.5 py-2.5" style={{ fontFamily: SYSTEM_FONT }}>
            <div className="text-[15px] leading-[19px] text-white">Tap to redeem &mdash; Taqueria Sol</div>
            <div className="text-[13px] leading-[16px] text-[rgba(235,235,245,.5)] mt-[2px]">getcoop.cash</div>
          </div>
        </div>
        <Bubble mine radius="20px" animation="pMsg4 7s ease-out infinite" className="mt-[7px]">
          on my way
        </Bubble>
      </div>
    </div>
  )
}
