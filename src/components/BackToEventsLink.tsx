'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

// Navigating back (rather than pushing a fresh "/" route) lets Next.js
// restore the previous events list from its router cache, so filters
// like the selected date tab stay put instead of resetting to "tonight".
// document.referrer doesn't update on client-side (SPA) navigations, so we
// can't use it to detect "came from the home page" — HomeClient sets a
// sessionStorage flag instead, which does survive across soft navigations.
export default function BackToEventsLink() {
  const router = useRouter()

  const handleClick = () => {
    let cameFromHome = false
    try {
      cameFromHome = sessionStorage.getItem('nyack-visited-home') === 'true'
    } catch {
      // sessionStorage unavailable
    }

    if (cameFromHome && window.history.length > 1) {
      router.back()
    } else {
      router.push('/')
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-terra transition-colors mb-4 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-terra"
    >
      <ArrowLeft className="w-4 h-4" aria-hidden="true" />
      Back to events
    </button>
  )
}
