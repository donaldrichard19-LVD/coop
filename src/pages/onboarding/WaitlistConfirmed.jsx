import { BrandMark } from '../../components/Header'

export default function WaitlistConfirmed() {
  return (
    <div className="min-h-svh bg-bg-primary flex flex-col items-center justify-center px-6 text-center gap-4">
      <BrandMark size={40} />
      <h1 className="text-title2 text-text-primary max-w-[18ch]">you&rsquo;re on the list.</h1>
      <p className="text-body text-text-secondary max-w-[32ch]">
        we&rsquo;re lining up your first deals. you&rsquo;ll get a text the moment they&rsquo;re ready &mdash; keep an eye on
        your messages.
      </p>
    </div>
  )
}
