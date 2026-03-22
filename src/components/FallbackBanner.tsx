'use client'

import { X, MoonStar } from 'lucide-react'

interface FallbackBannerProps {
  onDismiss: () => void
}

export default function FallbackBanner({ onDismiss }: FallbackBannerProps) {
  return (
    <div className="relative flex gap-4 px-5 py-4 mb-6 bg-orange-50 border-2 border-orange-200 rounded-xl">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
        <MoonStar className="w-5 h-5 text-orange-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-orange-900 leading-snug">
          Nothing happening in Nyack tonight
        </p>
        <p className="text-sm text-orange-700 mt-0.5">
          Here&apos;s what&apos;s coming up this week instead.
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 text-orange-400 hover:text-orange-600 transition-colors mt-0.5"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
