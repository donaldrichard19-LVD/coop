import { useState } from 'react'
import Avatar from '../components/Avatar'
import Button from '../components/Button'

function expiryStatus(deal) {
  if (deal.status === 'used') return { color: 'bg-success', label: deal.endsLabel ?? 'Redeemed' }
  if (deal.status === 'expired') return null
  if (deal.status === 'endingToday') return { color: 'bg-danger', label: deal.endsLabel }
  if (deal.status === 'expiring') return { color: 'bg-warning', label: deal.endsLabel }
  return null
}

export default function DealCard({ deal, inThread = false, saved = false, onSave, onDirections }) {
  const [copied, setCopied] = useState(false)
  const expired = deal.status === 'expired'
  const status = expiryStatus(deal)

  const badge = saved ? 'SAVED' : deal.merchant.visitCount >= 4 ? 'REGULAR' : null

  function handleCopy() {
    navigator.clipboard?.writeText(deal.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      className={`bg-surface-elevated border border-separator-subtle rounded-large flex flex-col animate-rise-in ${
        inThread ? 'p-4 gap-3' : 'p-5 gap-4'
      } ${expired ? 'opacity-60' : ''}`}
    >
      {/* Who */}
      <div className="flex items-center gap-3">
        <Avatar initials={deal.merchant.initials} size={44} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-headline text-text-primary truncate">{deal.merchant.name}</p>
            {badge && !expired && (
              <span className="shrink-0 text-caption uppercase font-semibold bg-fill text-text-primary px-2 py-0.5 rounded-capsule">
                {badge}
              </span>
            )}
          </div>
          <p className="text-footnote text-text-secondary truncate">
            {deal.merchant.visitCount} visits since {deal.merchant.firstVisit} · {deal.merchant.distance}
          </p>
        </div>
      </div>

      {/* What */}
      <p className={inThread ? 'text-callout text-text-primary' : 'text-title2 text-text-primary'}>
        {deal.offer}
      </p>

      {/* What it's worth */}
      {!expired && (
        <p className="text-headline text-text-primary">
          You save ~${deal.savingsAmount.toFixed(2)}
          {deal.originalPrice != null && (
            <span className="text-subheadline text-text-tertiary line-through ml-2">
              ${deal.originalPrice.toFixed(2)}
            </span>
          )}
        </p>
      )}

      {/* When */}
      {status && (
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-capsule shrink-0 ${status.color}`} />
          <span className="text-footnote text-text-secondary">{status.label}</span>
        </div>
      )}

      {/* Promo code well */}
      {!expired && deal.code && (
        <div className="flex items-center justify-between bg-bg-primary rounded-medium px-3.5 py-3">
          <span className="text-monospaced text-text-primary">{deal.code}</span>
          <button
            onClick={handleCopy}
            className="text-subheadline font-semibold text-tint-primary hover:opacity-70 transition-opacity duration-fast"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}

      {/* Actions */}
      {expired ? (
        <Button variant="secondary" className="w-full opacity-60" disabled>
          notify me if it's back
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" onClick={() => onSave?.(deal)}>
            {saved ? 'saved' : 'save it'}
          </Button>
          <Button variant="secondary" onClick={() => onDirections?.(deal)}>
            directions
          </Button>
        </div>
      )}
    </div>
  )
}
