export default function SavingsSummary({ amount, label = 'saved this month', categories = [] }) {
  return (
    <div className="bg-surface-elevated border border-separator-subtle rounded-large p-6 flex flex-col gap-5">
      <div>
        <p className="text-footnote text-text-secondary">{label}</p>
        <p className="text-savingsFigure text-text-primary">${amount.toFixed(2)}</p>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-col gap-3">
          {categories.map((cat) => (
            <div key={cat.label} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[14px] text-text-primary">
                <span>{cat.label}</span>
                <span className="font-semibold">${cat.amount.toFixed(2)}</span>
              </div>
              <div className="h-[6px] rounded-[3px] bg-fill overflow-hidden">
                <div
                  className="h-full rounded-[3px] bg-tint-primary transition-[width] duration-slow ease-spring"
                  style={{ width: `${Math.min(100, cat.percent)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
