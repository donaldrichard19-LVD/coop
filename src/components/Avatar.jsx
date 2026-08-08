export default function Avatar({ initials, size = 44, className = '' }) {
  return (
    <div
      className={`shrink-0 rounded-capsule bg-fill text-text-primary font-semibold flex items-center justify-center ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  )
}
