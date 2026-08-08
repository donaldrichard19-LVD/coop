import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import Button from '../../components/Button'

export default function PhoneStep({ onNext, onBack }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  function submit(e) {
    e.preventDefault()
    const digits = value.replace(/\D/g, '')
    if (digits.length < 10) {
      setError(true)
      return
    }
    setError(false)
    onNext(digits)
  }

  return (
    <div className="min-h-svh bg-bg-primary flex items-center justify-center px-5">
      <div className="w-full max-w-[380px] bg-surface-elevated border border-separator-subtle rounded-large p-7">
        <div className="text-caption uppercase text-text-tertiary mb-2">Step 1 of 3</div>
        <h2 className="text-title2 text-text-primary mb-1.5">Where should we text you?</h2>
        <p className="text-subheadline text-text-secondary mb-6">
          Deals land here &mdash; RCS if your phone supports it, texts if not.
        </p>

        <form onSubmit={submit}>
          <label className="block text-caption font-semibold text-text-secondary mb-1.5" htmlFor="phone-input">
            Mobile number
          </label>
          <div
            className={`flex border rounded-medium overflow-hidden bg-bg-primary mb-1.5 ${
              error ? 'border-danger' : 'border-separator-subtle focus-within:border-tint-primary'
            }`}
          >
            <span className="px-3 py-3.5 text-body text-text-secondary border-r border-separator-subtle shrink-0">
              +1
            </span>
            <input
              id="phone-input"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="(555) 123-4567"
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setError(false)
              }}
              className="flex-1 min-w-0 bg-transparent px-3 py-3.5 text-body text-text-primary placeholder:text-text-tertiary outline-none font-mono"
            />
          </div>
          {error && <p className="text-caption text-danger mb-3">need a number first.</p>}

          <Button variant="primary" type="submit" className={`w-full justify-center ${error ? '' : 'mt-4'}`}>
            next
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
