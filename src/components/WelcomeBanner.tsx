'use client'

import { useState, useEffect } from 'react'

export default function WelcomeBanner() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    const hasVisited = localStorage.getItem('nyackToday_hasVisited')
    if (!hasVisited) {
      setShowBanner(true)
    }
  }, [])

  const handleDismiss = () => {
    localStorage.setItem('nyackToday_hasVisited', 'true')
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <div className="bg-gradient-to-r from-orange-100 to-amber-100 border-b border-orange-200">
      <div className="max-w-4xl mx-auto px-4 py-6 relative">
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-stone-600 hover:text-stone-900 transition-colors"
          aria-label="Close welcome message"
        >
          {/* X icon */}
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-start gap-4 pr-8">
          <div className="flex-shrink-0">
            {/* Sun icon */}
            <svg className="w-10 h-10 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>

          <div>
            <h2 className="text-xl font-bold text-stone-900 mb-1">
              Welcome to Nyack Today
            </h2>
            <p className="text-stone-700 text-sm leading-relaxed">
              Your local guide to what's happening in our corner of the Hudson Valley.
              Discover events, shows, and community happenings in and around Nyack.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
