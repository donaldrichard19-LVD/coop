export default function Chip({ selected = false, className = '', children, ...props }) {
  return (
    <button
      className={`shrink-0 whitespace-nowrap rounded-capsule text-subheadline px-4 py-2.5 border transition-[background-color,border-color,transform] duration-fast ease-spring active:scale-press ${
        selected
          ? 'bg-fill border-transparent text-text-primary'
          : 'bg-transparent border-separator-strong text-text-primary hover:bg-fill'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
