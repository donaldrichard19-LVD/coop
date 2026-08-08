export default function ThinkingIndicator({ label = 'checking your regulars…' }) {
  return (
    <p className="text-subheadline shimmer-text animate-shimmer" aria-live="polite">
      {label}
    </p>
  )
}
