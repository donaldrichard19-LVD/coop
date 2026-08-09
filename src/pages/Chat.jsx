import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Shell from '../components/Shell'
import Chip from '../components/Chip'
import Composer from '../components/Composer'
import Button from '../components/Button'
import ThinkingIndicator from '../components/ThinkingIndicator'
import { UserBubble, AssistantProse } from '../components/Message'
import DealCard from '../domain/DealCard'
import { DealsProvider, useDeals } from '../data/DealsContext'
import { quickReplies, matchDeals } from '../data/deals'

function greetingForNow() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning, Ava'
  if (hour < 18) return 'Good afternoon, Ava'
  return 'Good evening, Ava'
}

const FOLLOW_UPS = ['Only chain deals', 'Only local spots', 'Something cheaper', 'What else is close?']

// Wrapped in its own DealsProvider rather than one shared at the app root, so
// the /api/deals fetch only fires when Chat (or SavedDeals, which does the
// same) actually mounts — neither is on a live route yet, so this used to
// mean fetching on every single page load, including the landing pages that
// never touch deals data at all. Tradeoff: since each page now gets its own
// provider instance, "saved" state won't carry over if a user's client-side
// navigation goes Chat -> SavedDeals (it will refetch and reset saved state).
// Not a concern today since neither page is reachable from real routes yet;
// revisit with a shared nested-route provider if/when they're reconnected
// and cross-page persistence actually matters.
export default function Chat(props) {
  return (
    <DealsProvider>
      <ChatInner {...props} />
    </DealsProvider>
  )
}

function ChatInner({ startWithOffers = false }) {
  const { toggleSave, isSaved, deals, loading } = useDeals()
  const [messages, setMessages] = useState([])
  const [thinking, setThinking] = useState(false)
  const navigate = useNavigate()
  const threadRef = useRef(null)

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [messages, thinking])

  // Proactive push right out of onboarding, per the spec's core loop ("push
  // matches proactively") — not the generic empty-state greeting. Deliberately
  // bypasses matchDeals() (excludes 'used' too, not just 'expired') for this
  // one curated moment. Runs once deals actually finish loading, since they're
  // now fetched async instead of available synchronously at mount.
  useEffect(() => {
    if (!startWithOffers || loading || deals.length === 0) return
    const eligible = deals.filter((d) => d.status !== 'expired' && d.status !== 'used')
    const shown = eligible.slice(0, 2)
    setMessages([
      {
        id: 'a-proactive',
        role: 'assistant',
        text: `connected. found ${shown.length} deals already.`,
        dealIds: shown.map((d) => d.id),
        overflowCount: Math.max(0, eligible.length - shown.length),
        overflowTotal: eligible.length,
      },
    ])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  function respond(query) {
    const matches = matchDeals(query, deals)
    const shown = matches.slice(0, 2)
    const overflow = matches.length - shown.length

    setThinking(true)
    setTimeout(() => {
      setThinking(false)
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text:
            shown.length > 0
              ? `found ${matches.length === 1 ? 'one' : matches.length} you haven't used yet. here's what's closest.`
              : 'not seeing that one in your regulars yet.',
          dealIds: shown.map((d) => d.id),
          overflowCount: overflow > 0 ? overflow : 0,
          overflowTotal: matches.length,
        },
      ])
    }, 900)
  }

  function handleSend(text) {
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text }])
    respond(text)
  }

  const isNewConversation = messages.length === 0

  if (isNewConversation) {
    return (
      <Shell>
        <div className="flex-1 flex flex-col justify-end px-5 pb-6">
          <div className="mb-6">
            <h1 className="text-largeTitle text-text-primary">{greetingForNow()}</h1>
            <p className="text-body text-text-secondary mt-1 max-w-[30ch]">
              3 of your regulars have something running this week.
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {quickReplies.slice(0, 3).map((q) => (
              <Chip key={q} onClick={() => handleSend(q)}>
                {q}
              </Chip>
            ))}
          </div>
        </div>
        <Composer onSend={handleSend} />
      </Shell>
    )
  }

  return (
    <Shell title="Tonight nearby" bordered>
      <div ref={threadRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-[14px]">
        <div className="max-w-[720px] w-full mx-auto flex flex-col gap-[14px]">
          {messages.map((m) => (
            <MessageTurn
              key={m.id}
              message={m}
              onSave={toggleSave}
              isSaved={isSaved}
              onSeeAll={() => navigate('/saved', { state: { tab: 'nearby' } })}
            />
          ))}
          {thinking && <ThinkingIndicator />}
          {!thinking && messages.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 pt-1 -mx-1 px-1">
              {FOLLOW_UPS.map((q) => (
                <Chip key={q} onClick={() => handleSend(q)}>
                  {q}
                </Chip>
              ))}
            </div>
          )}
        </div>
      </div>
      <Composer onSend={handleSend} />
    </Shell>
  )
}

function MessageTurn({ message, onSave, isSaved, onSeeAll }) {
  const { deals } = useDeals()

  if (message.role === 'user') {
    return <UserBubble>{message.text}</UserBubble>
  }

  const cards = (message.dealIds ?? []).map((id) => deals.find((d) => d.id === id)).filter(Boolean)

  return (
    <div className="flex flex-col gap-3">
      <AssistantProse>{message.text}</AssistantProse>
      {cards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {cards.map((deal) => (
            <DealCard key={deal.id} deal={deal} inThread saved={isSaved(deal.id)} onSave={() => onSave(deal.id)} />
          ))}
        </div>
      )}
      {message.overflowCount > 0 && (
        <Button variant="text" className="self-start px-0" onClick={onSeeAll}>
          see all {message.overflowTotal}
        </Button>
      )}
    </div>
  )
}
