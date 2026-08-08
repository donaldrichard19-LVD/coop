import { X, MessageCirclePlus, Wallet } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { BrandMark } from './Header'

function DrawerContent({ onNewConversation, onNavigate }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-5 py-4">
        <BrandMark />
        <span className="text-headline text-text-primary">coop</span>
      </div>

      <div className="px-3">
        <button
          onClick={onNewConversation}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-medium text-body text-text-primary hover:bg-fill transition-colors duration-fast"
        >
          <MessageCirclePlus size={18} />
          New conversation
        </button>
      </div>

      <div className="px-3 mt-2">
        <p className="px-3 text-caption uppercase text-text-tertiary mb-1">Recent</p>
        <button className="w-full text-left px-3 py-2.5 rounded-medium text-subheadline text-text-primary bg-fill">
          Tonight nearby
        </button>
      </div>

      <div className="mt-auto px-3 pb-4">
        <NavLink
          to="/saved"
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2.5 rounded-medium text-body transition-colors duration-fast ${
              isActive ? 'bg-fill text-text-primary' : 'text-text-primary hover:bg-fill'
            }`
          }
        >
          <Wallet size={18} />
          Your deals
        </NavLink>
      </div>
    </div>
  )
}

export default function Drawer({ open, onClose, onNewConversation }) {
  return (
    <>
      {/* Mobile overlay drawer */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-slow ease-spring md:hidden ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[300px] bg-surface-elevated border-r border-separator-subtle transition-transform duration-slow ease-spring md:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex justify-end px-3 pt-3">
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="w-11 h-11 rounded-capsule flex items-center justify-center text-text-primary hover:bg-fill transition-colors duration-fast"
          >
            <X size={20} />
          </button>
        </div>
        <DrawerContent onNewConversation={onNewConversation} onNavigate={onClose} />
      </div>

      {/* Persistent desktop sidebar */}
      <div className="hidden md:flex md:flex-col w-[320px] shrink-0 border-r border-separator-subtle bg-surface-elevated">
        <DrawerContent onNewConversation={onNewConversation} />
      </div>
    </>
  )
}
