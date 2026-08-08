import { useEffect, useState } from 'react'
import { X, Check, ChevronLeft } from 'lucide-react'

const BANKS = [
  { name: 'Chase', color: '#117ACA' },
  { name: 'Bank of America', color: '#CC0000' },
  { name: 'Wells Fargo', color: '#D71E2B' },
  { name: 'Capital One', color: '#004977' },
  { name: 'Citi', color: '#056DAE' },
  { name: 'US Bank', color: '#0C2074' },
]

function initials(name) {
  const words = name.split(' ')
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return words.map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

// Fully simulated — no real Plaid Link SDK, no network calls, nothing typed
// here is read or stored. Real integration is still an open item (see
// project memory) — this proves the onboarding shape without needing live
// Plaid credentials.
export default function PlaidStep({ onDone }) {
  const [sub, setSub] = useState('intro')
  const [bank, setBank] = useState(BANKS[0])
  const [query, setQuery] = useState('')
  const [linkStep, setLinkStep] = useState(-1)

  useEffect(() => {
    if (sub !== 'linking') return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const delay = reduceMotion ? 0 : 550
    const timers = [0, 1, 2].map((i) => setTimeout(() => setLinkStep(i), i * delay + delay))
    const done = setTimeout(() => setSub('success'), 3 * delay + 200)
    return () => {
      timers.forEach(clearTimeout)
      clearTimeout(done)
    }
  }, [sub])

  const filteredBanks = BANKS.filter((b) => b.name.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="min-h-svh flex items-center justify-center px-5" style={{ background: '#e8e4da' }}>
      <div className="w-full max-w-[420px] max-h-[88svh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[#16192b]">
        <div className="flex items-center justify-between px-[18px] py-4 border-b border-[#eceef2]">
          <div className="flex items-center gap-2 text-[13.5px] font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#0b57d0]" />
            Connect a bank account
          </div>
          <button onClick={() => setSub('intro')} className="text-[#8a8f9c] hover:text-[#16192b]" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="px-[22px] py-5 overflow-y-auto">
          {sub === 'intro' && (
            <>
              <h3 className="text-[18px] font-semibold mb-2">Coop uses Plaid to connect your bank</h3>
              <p className="text-[13.5px] text-[#5b6072] leading-relaxed mb-4">
                Plaid securely links your accounts so Coop can see which merchants you&rsquo;ve visited. It
                can&rsquo;t see your login, and Coop never sees full account numbers.
              </p>
              <ul className="flex flex-col gap-2.5 mb-5">
                {[
                  'See transactions from the last 6 months',
                  'Match merchants — not track spending categories or balances',
                  'Disconnect anytime from Settings',
                ].map((line) => (
                  <li key={line} className="flex gap-2.5 text-[13px] text-[#3a3f52]">
                    <Check size={14} className="text-[#0b57d0] shrink-0 mt-0.5" />
                    {line}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setSub('search')}
                className="w-full bg-[#0b57d0] hover:bg-[#0a4bb8] text-white rounded-[10px] py-3 text-[14.5px] font-semibold"
              >
                Continue
              </button>
              <p className="text-[11.5px] text-[#8a8f9c] bg-[#f5f6f9] rounded-lg px-2.5 py-2 mt-3.5 leading-relaxed">
                Simulated for this prototype &mdash; no real bank connection is made, and nothing typed here
                is sent anywhere.
              </p>
            </>
          )}

          {sub === 'search' && (
            <>
              <h3 className="text-[18px] font-semibold mb-3">Search for your bank</h3>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search banks"
                className="w-full border border-[#e2e4ea] rounded-[10px] px-3.5 py-2.5 text-[14px] mb-3.5 outline-none focus:border-[#0b57d0]"
              />
              <div className="grid grid-cols-2 gap-2">
                {filteredBanks.map((b) => (
                  <button
                    key={b.name}
                    onClick={() => {
                      setBank(b)
                      setSub('login')
                    }}
                    className="flex items-center gap-2.5 border border-[#e2e4ea] rounded-[10px] px-2.5 py-2.5 text-left hover:border-[#0b57d0] hover:bg-[#f7f9ff]"
                  >
                    <span
                      className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
                      style={{ background: b.color }}
                    >
                      {initials(b.name)}
                    </span>
                    <span className="text-[12.5px] font-semibold">{b.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {sub === 'login' && (
            <>
              <button
                onClick={() => setSub('search')}
                className="flex items-center gap-1 text-[12.5px] text-[#5b6072] mb-3.5"
              >
                <ChevronLeft size={12} /> Back
              </button>
              <h3 className="text-[18px] font-semibold mb-2">Log in to {bank.name}</h3>
              <p className="text-[13.5px] text-[#5b6072] mb-3.5">This is a simulated login &mdash; enter anything.</p>
              <label className="block text-[12px] font-medium text-[#5b6072] mb-1.5">Username</label>
              <input className="w-full border border-[#e2e4ea] rounded-[10px] px-3 py-2.5 text-[14px] mb-3.5 outline-none focus:border-[#0b57d0]" placeholder="username" autoComplete="off" />
              <label className="block text-[12px] font-medium text-[#5b6072] mb-1.5">Password</label>
              <input type="password" className="w-full border border-[#e2e4ea] rounded-[10px] px-3 py-2.5 text-[14px] mb-4 outline-none focus:border-[#0b57d0]" placeholder="password" autoComplete="off" />
              <button
                onClick={() => setSub('linking')}
                className="w-full bg-[#0b57d0] hover:bg-[#0a4bb8] text-white rounded-[10px] py-3 text-[14.5px] font-semibold"
              >
                Submit
              </button>
              <p className="text-[11.5px] text-[#8a8f9c] bg-[#f5f6f9] rounded-lg px-2.5 py-2 mt-3.5 leading-relaxed">
                Demo only &mdash; please don&rsquo;t enter real credentials. Nothing here is transmitted or stored.
              </p>
            </>
          )}

          {sub === 'linking' && (
            <div className="text-center py-4">
              <div
                className="w-11 h-11 mx-auto mb-5 rounded-full border-[3px] border-[#e2e4ea] motion-reduce:animate-none"
                style={{ borderTopColor: '#0b57d0', animation: 'coop-plaid-spin 0.8s linear infinite' }}
              />
              <div className="flex flex-col gap-2.5 text-left max-w-[260px] mx-auto">
                {[`Connecting to ${bank.name}`, 'Verifying accounts', 'Analyzing recent activity'].map((label, i) => (
                  <div
                    key={label}
                    className={`flex items-center gap-2 text-[13px] transition-colors ${
                      i <= linkStep ? 'text-[#16192b]' : 'text-[#b7bac4]'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full border-[1.5px] shrink-0 flex items-center justify-center ${
                        i <= linkStep ? 'bg-[#0b57d0] border-[#0b57d0] text-white' : 'border-[#d5d7de]'
                      }`}
                    >
                      {i <= linkStep && <Check size={10} />}
                    </span>
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {sub === 'success' && (
            <div className="text-center py-2.5">
              <div className="w-[52px] h-[52px] mx-auto mb-4.5 rounded-full bg-[#e7f6ec] text-[#1d8a4a] flex items-center justify-center">
                <Check size={24} />
              </div>
              <h3 className="text-[18px] font-semibold mb-1.5">Accounts connected</h3>
              <p className="text-[13.5px] text-[#5b6072] mb-3.5">Coop can now match deals against where you actually spend.</p>
              <div className="flex items-center justify-between border border-[#eceef2] rounded-[10px] px-3.5 py-2.5 text-[13px] mb-2">
                <span className="font-semibold">{bank.name} Checking</span>
                <span className="text-[#8a8f9c] font-mono text-[11.5px]">•••• 4821</span>
              </div>
              <div className="flex items-center justify-between border border-[#eceef2] rounded-[10px] px-3.5 py-2.5 text-[13px] mb-4">
                <span className="font-semibold">{bank.name} Credit Card</span>
                <span className="text-[#8a8f9c] font-mono text-[11.5px]">•••• 7734</span>
              </div>
              <button
                onClick={onDone}
                className="w-full bg-[#0b57d0] hover:bg-[#0a4bb8] text-white rounded-[10px] py-3 text-[14.5px] font-semibold"
              >
                Continue
              </button>
            </div>
          )}
        </div>
      </div>
      <style>{'@keyframes coop-plaid-spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  )
}
