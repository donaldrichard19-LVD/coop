import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { BrandMark } from '../../components/Header'

// Shared chrome for /privacy and /terms. Both are DRAFT legal copy (see the
// notice below) — not the app's normal dark-landing pages, so kept out of
// the Gate in App.jsx and reachable from any device via a plain footer link.
export default function LegalLayout({ title, updated, children }) {
  return (
    <div data-theme="dark" className="landing-dark min-h-svh bg-bg-primary px-5 py-8 min-[700px]:px-14 min-[700px]:py-10">
      <div className="max-w-[720px] mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-[15px] font-medium text-text-secondary hover:text-text-primary transition-colors mb-10">
          <ArrowLeft size={16} strokeWidth={2} />
          back to coop
        </Link>

        <div className="flex items-center gap-2 mb-2">
          <BrandMark size={22} />
          <span className="text-[16px] font-extrabold tracking-[-0.03em] text-text-primary">coop</span>
        </div>

        <h1 className="text-[32px] font-extrabold tracking-[-0.03em] text-text-primary mb-1">{title}</h1>
        <p className="text-[14px] text-text-tertiary mb-10">Last updated {updated}</p>

        <div className="rounded-[16px] bg-surface-elevated px-5 py-4 text-[14px] leading-[1.55] text-text-secondary mb-10">
          <strong className="text-text-primary">Draft notice:</strong> this is placeholder legal copy, not
          reviewed by counsel. Replace it with a lawyer-vetted policy before it governs real user data or SMS
          traffic (TCPA/CTIA rules apply to the texting flow, and Plaid imposes its own data-use terms once
          that integration ships).
        </div>

        <div className="space-y-8 text-[16px] leading-[1.65] text-text-secondary [&_h2]:text-[19px] [&_h2]:font-bold [&_h2]:text-text-primary [&_h2]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_a]:text-tint-primary [&_a]:underline">
          {children}
        </div>

        <p className="text-[14px] text-text-tertiary mt-12 pb-10">
          Questions? Reach us at <a href="mailto:support@getcoop.cash" className="text-tint-primary underline">support@getcoop.cash</a>.
        </p>
      </div>
    </div>
  )
}
