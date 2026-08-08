export function UserBubble({ children }) {
  return (
    <div className="flex justify-end">
      <div
        className="max-w-[78%] bg-surface-bubble text-text-primary text-body px-4 py-3"
        style={{ borderRadius: '24px 24px 8px 24px' }}
      >
        {children}
      </div>
    </div>
  )
}

export function AssistantProse({ children }) {
  return (
    <div className="max-w-[88%] text-body text-text-primary" style={{ lineHeight: 1.5 }}>
      {children}
    </div>
  )
}
