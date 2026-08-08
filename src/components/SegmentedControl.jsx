export default function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="flex bg-fill rounded-capsule p-0.5 gap-0.5">
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 text-subheadline font-semibold rounded-capsule py-2 transition-[background-color,color] duration-standard ease-spring ${
              active ? 'bg-surface-elevated text-text-primary shadow-sm' : 'text-text-secondary'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
