import Avatar from '../components/Avatar'

export default function MerchantListRow({ deal }) {
  const expired = deal.status === 'expired'
  return (
    <div className={`flex items-center gap-3 py-3 min-h-[72px] ${expired ? 'opacity-50' : ''}`}>
      <Avatar initials={deal.merchant.initials} size={40} />
      <div className="flex-1 min-w-0">
        <p className="text-callout font-semibold text-text-primary truncate">{deal.offer}</p>
        <p className="text-footnote text-text-secondary truncate">
          {deal.merchant.name} · {deal.endsLabel}
        </p>
      </div>
      {!expired && (
        <span className="text-callout font-semibold text-text-primary shrink-0">
          ${deal.savingsAmount.toFixed(2)}
        </span>
      )}
    </div>
  )
}
