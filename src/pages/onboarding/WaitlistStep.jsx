import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import Button from '../../components/Button'
import { submitWaitlist } from '../../lib/api'

export default function WaitlistStep({ onDone, onBack }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) {
      setError('need your name first.')
      return
    }
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) {
      setError('need a number first.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await submitWaitlist({ name: name.trim(), phone: digits })
      onDone()
    } catch {
      setError("that didn't go through — try again?")
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-svh bg-bg-primary flex items-center justify-center px-5">
      <div className="w-full max-w-[380px] bg-surface-elevated border border-separator-subtle rounded-large p-7">
        <h2 className="text-title2 text-text-primary mb-1.5">Where should we text you?</h2>
        <p className="text-subheadline text-text-secondary mb-6">
          We&rsquo;ll text you the moment we&rsquo;ve got deals from your regulars.
        </p>

        <form onSubmit={submit}>
          <label className="block text-caption font-semibold text-text-secondary mb-1.5" htmlFor="name-input">
            Name
          </label>
          <input
            id="name-input"
            type="text"
            autoComplete="name"
            placeholder="Ava"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError('')
            }}
            className="w-full border border-separator-subtle focus:border-tint-primary rounded-medium bg-bg-primary px-3.5 py-3.5 text-body text-text-primary placeholder:text-text-tertiary outline-none mb-4"
          />

          <label className="block text-caption font-semibold text-text-secondary mb-1.5" htmlFor="phone-input">
            Mobile number
          </label>
          <div className="flex border border-separator-subtle focus-within:border-tint-primary rounded-medium overflow-hidden bg-bg-primary mb-1.5">
            <span className="px-3 py-3.5 text-body text-text-secondary border-r border-separator-subtle shrink-0">
              +1
            </span>
            <input
              id="phone-input"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="(555) 123-4567"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
                setError('')
              }}
              className="flex-1 min-w-0 bg-transparent px-3 py-3.5 text-body text-text-primary placeholder:text-text-tertiary outline-none font-mono"
            />
          </div>
          {error && <p className="text-caption text-danger mb-3">{error}</p>}

          <Button
            variant="primary"
            type="submit"
            disabled={submitting}
            className={`w-full justify-center ${error ? '' : 'mt-4'}`}
          >
            {submitting ? 'sending…' : "let's go"}
          </Button>
        </form>

        <button
          onClick={onBack}
          className="flex items-center gap-1 text-caption text-text-tertiary hover:text-tint-primary mt-4"
        >
          <ChevronLeft size={12} /> Back
        </button>
      </div>
    </div>
  )
}
