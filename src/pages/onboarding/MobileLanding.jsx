import { BrandMark } from '../../components/Header'
import Button from '../../components/Button'
import DealCard from '../../domain/DealCard'
import { deals } from '../../data/deals'

const previewDeal = deals.find((d) => d.id === 'd-bluebottle')

export default function MobileLanding({ onNext }) {
  return (
    <div className="min-h-svh bg-bg-primary flex flex-col">
      <nav className="px-5 pt-6 flex items-center gap-2">
        <BrandMark size={26} />
        <span className="text-headline text-text-primary">coop</span>
      </nav>

      <div className="flex-1 px-5 pt-8 pb-6">
        <p className="text-footnote font-semibold text-tint-primary mb-2">text it. save it.</p>
        <h1 className="text-largeTitle text-text-primary max-w-[13ch]" style={{ textWrap: 'balance' }}>
          your deal-finding friend, right in your texts.
        </h1>
        <p className="text-body text-text-secondary mt-3">
          Connect your bank once. Coop watches the places you actually go &mdash; coffee shops,
          lunch spots, the pizza place you always order from &mdash; and texts you the second one
          of them&rsquo;s got a deal. No new app. No hunting for codes.
        </p>

        <Button variant="primary" className="w-full justify-center mt-6" onClick={onNext}>
          let&rsquo;s go
        </Button>
        <p className="text-caption text-text-tertiary text-center mt-2">about a minute. no card.</p>

        <div className="mt-8">
          <DealCard deal={previewDeal} inThread />
        </div>
      </div>
    </div>
  )
}
