import { useRef, useState } from 'react'
import { Plus, ArrowUp } from 'lucide-react'
import { IconButton } from './Button'

const LINE_HEIGHT = 22
const MAX_LINES = 5

export default function Composer({ onSend, placeholder = 'ask about a deal…' }) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef(null)

  function autoResize(el) {
    el.style.height = 'auto'
    const maxHeight = LINE_HEIGHT * MAX_LINES
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  }

  function handleChange(e) {
    setValue(e.target.value)
    autoResize(e.target)
  }

  function submit() {
    const trimmed = value.trim()
    if (!trimmed) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const hasContent = value.trim().length > 0

  return (
    <div className="bg-surface-elevated border-t border-separator-subtle px-4 py-3">
      <div
        className={`flex items-end gap-2 bg-bg-primary rounded-capsule border p-2 transition-colors duration-fast ${
          focused ? 'border-[1.5px] border-tint-primary' : 'border border-separator-subtle'
        }`}
      >
        <IconButton variant="fill" aria-label="Attach">
          <Plus size={18} strokeWidth={2.25} />
        </IconButton>

        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className="flex-1 resize-none bg-transparent text-body text-text-primary placeholder:text-text-tertiary outline-none py-2 max-h-[110px] overflow-y-auto"
        />

        <IconButton
          variant={hasContent ? 'cta' : 'fill'}
          disabled={!hasContent}
          onClick={submit}
          aria-label="Send"
          className={hasContent ? '' : 'text-text-tertiary'}
        >
          <ArrowUp size={18} strokeWidth={2.25} />
        </IconButton>
      </div>
    </div>
  )
}
