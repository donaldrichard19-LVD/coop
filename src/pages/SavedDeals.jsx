import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Shell from '../components/Shell'
import SegmentedControl from '../components/SegmentedControl'
import Button from '../components/Button'
import SavingsSummary from '../domain/SavingsSummary'
import MerchantListRow from '../domain/MerchantListRow'
import { DealsProvider, useDeals } from '../data/DealsContext'

const TABS = [
  { value: 'saved', label: 'Saved' },
  { value: 'nearby', label: 'Nearby' },
  { value: 'used', label: 'Used' },
]

// See the matching comment in Chat.jsx for why this wraps itself in its own
// DealsProvider instead of relying on one shared at the app root.
export default function SavedDeals() {
  return (
    <DealsProvider>
      <SavedDealsInner />
    </DealsProvider>
  )
}

function SavedDealsInner() {
  const location = useLocation()
  const navigate = useNavigate()
  const [tab, setTab] = useState(location.state?.tab ?? 'saved')
  const { savedDeals, nearbyDeals, usedDeals, savingsThisMonth, categoryBreakdown } = useDeals()

  const rows = tab === 'saved' ? savedDeals : tab === 'nearby' ? nearbyDeals : usedDeals

  return (
    <Shell title="Your deals" bordered>
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        <div className="max-w-[720px] w-full mx-auto flex flex-col gap-6">
          <h1 className="text-largeTitle text-text-primary">Your deals</h1>

          <SegmentedControl options={TABS} value={tab} onChange={setTab} />

          <SavingsSummary amount={savingsThisMonth} categories={categoryBreakdown} />

          <div className="flex flex-col divide-y divide-separator-subtle">
            {rows.length > 0 ? (
              rows.map((deal) => <MerchantListRow key={deal.id} deal={deal} />)
            ) : (
              <p className="text-subheadline text-text-secondary py-6 text-center">
                nothing here yet.
              </p>
            )}
          </div>

          <Button
            variant="secondary"
            className="w-full"
            onClick={() => navigate('/', { state: { primed: true } })}
          >
            ask for something specific
          </Button>
        </div>
      </div>
    </Shell>
  )
}
