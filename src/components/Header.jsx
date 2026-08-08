import { Menu } from 'lucide-react'
import Avatar from './Avatar'

// The mark's natural aspect (bubble + tail) is taller than it is wide, so
// `size` sets height and width follows automatically — forcing it into a
// square would distort the tail. Colors are fixed by brand spec (savings
// green, not the app's Ember tint) and don't react to light/dark theme;
// green reads fine on both this app's light and dark surfaces, so no
// colorway swap is needed here. See public/brand + README for the full system.
export function BrandMark({ size = 28, className = '' }) {
  return <img src="/brand/coop-mark.svg" alt="Coop" className={`shrink-0 ${className}`} style={{ height: size, width: 'auto' }} />
}

export default function Header({ title, onMenuClick, bordered = false }) {
  return (
    <header
      className={`flex items-center justify-between px-4 py-2.5 shrink-0 ${
        bordered ? 'border-b border-separator-subtle bg-surface-elevated' : ''
      }`}
    >
      <button
        onClick={onMenuClick}
        aria-label="Menu"
        className="w-11 h-11 rounded-capsule flex items-center justify-center text-text-primary hover:bg-fill transition-colors duration-fast shrink-0"
      >
        <Menu size={22} strokeWidth={2} />
      </button>

      {title ? (
        <h1 className="text-headline text-text-primary truncate flex-1 text-center">{title}</h1>
      ) : (
        <div className="flex items-center gap-2">
          <BrandMark />
          <span className="text-headline text-text-primary">coop</span>
        </div>
      )}

      <Avatar initials="A" size={44} />
    </header>
  )
}
