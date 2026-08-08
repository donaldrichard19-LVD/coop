export default function ErrorRow({ message = 'something went wrong', onRetry }) {
  return (
    <button
      onClick={onRetry}
      className="flex items-center gap-2 bg-fill rounded-medium px-4 py-2.5 text-subheadline text-text-secondary hover:bg-fill-strong transition-colors duration-fast"
    >
      <span className="w-1.5 h-1.5 rounded-capsule bg-danger shrink-0" />
      {message} · tap to retry
    </button>
  )
}
