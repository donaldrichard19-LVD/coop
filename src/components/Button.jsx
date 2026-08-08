const base =
  'inline-flex items-center justify-center gap-1.5 rounded-capsule text-body font-semibold transition-[opacity,background-color,border-color,transform] duration-fast ease-spring active:scale-press disabled:pointer-events-none select-none'

const variants = {
  primary: 'bg-tint-cta text-text-inverse px-6 py-3.5 hover:opacity-85 disabled:bg-fill disabled:text-text-tertiary',
  secondary: 'bg-fill text-text-primary px-6 py-3.5 hover:bg-fill-strong',
  outline:
    'bg-transparent text-text-primary px-[23px] py-[13px] border-[1.5px] border-separator-strong hover:border-text-primary',
  text: 'bg-transparent text-tint-primary px-2 py-2 hover:opacity-70',
}

export default function Button({ variant = 'primary', className = '', children, ...props }) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}

export function IconButton({ variant = 'fill', className = '', children, ...props }) {
  const iconVariants = {
    fill: 'bg-fill text-text-primary hover:bg-fill-strong',
    cta: 'bg-tint-cta text-text-inverse hover:opacity-85 disabled:bg-fill disabled:text-text-tertiary',
  }
  return (
    <button
      className={`w-11 h-11 shrink-0 rounded-capsule flex items-center justify-center transition-[opacity,background-color,transform] duration-fast ease-spring active:scale-press disabled:pointer-events-none ${iconVariants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
