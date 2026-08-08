import { MapPin } from 'lucide-react'

// Simulated — matches the OS's own permission-dialog conventions rather
// than Coop's brand voice, since it's meant to read as the device talking,
// not the app. (No real geolocation is requested; nothing downstream uses
// it yet — same "future integration point" status as Plaid below.)
export default function LocationStep({ onNext }) {
  return (
    <div className="min-h-svh flex items-center justify-center px-6" style={{ background: '#e8e4da' }}>
      <div className="w-full max-w-[320px] bg-[#fbfbfb] rounded-[20px] pt-6 px-5 pb-0 text-center shadow-2xl">
        <div className="w-11 h-11 mx-auto mb-3.5 rounded-full bg-[#eef0f2] flex items-center justify-center text-[#4a4a4f]">
          <MapPin size={20} />
        </div>
        <h3 className="text-[16px] font-semibold text-[#1b1b1f] mb-2">
          Allow Coop to access this device&rsquo;s location?
        </h3>
        <p className="text-[13.5px] text-[#55555a] leading-relaxed mb-4">
          So we can tell you how close a deal is &mdash; like &quot;0.3 mi.&quot; Change this anytime.
        </p>
        <div className="flex flex-col border-t border-[#e2e2e5] -mx-5">
          <button
            onClick={onNext}
            className="py-3.5 text-[15px] text-[#0b57d0] border-b border-[#e2e2e5] hover:bg-[#f2f2f4]"
          >
            Allow
          </button>
          <button onClick={onNext} className="py-3.5 text-[15px] text-[#55555a] hover:bg-[#f2f2f4]">
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
