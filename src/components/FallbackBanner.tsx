'use client'

import { X, MoonStar } from 'lucide-react'

interface FallbackBannerProps {
  onDismiss: () => void
}

export default function FallbackBanner({ onDismiss }: FallbackBannerProps) {
  return (
    <div className="relative flex gap-4 px-5 py-4 mb-6 bg-oat border border-sand rounded-xl">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-harvest/15 flex items-center justify-center">
        <MoonStar className="w-5 h-5 text-harvest" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-ink leading-snug">
          Nothing happening in Nyack tonight
        </p>
        <p className="text-sm text-muted mt-0.5">
          Here&apos;s what&apos;s coming up this week instead.
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 text-muted hover:text-ink transition-colors mt-0.5"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
