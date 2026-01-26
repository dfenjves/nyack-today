'use client'

import FeatureHighlights from './FeatureHighlights'
import FeaturedEvents from './FeaturedEvents'

export default function Hero() {
  const scrollToEvents = () => {
    const eventsSection = document.getElementById('events-section')
    eventsSection?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-200 via-amber-300 to-orange-400 -z-10" />

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 max-w-6xl mx-auto w-full">
        {/* Hero headline */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-7xl font-bold text-stone-900 mb-4">
            Nyack Today
          </h1>
          <p className="text-xl md:text-2xl text-stone-800">
            Your guide to what's happening in our corner of the Hudson Valley
          </p>
        </div>

        {/* Feature highlights */}
        <div className="w-full mb-12">
          <FeatureHighlights />
        </div>

        {/* Tonight's featured events */}
        <div className="w-full">
          <FeaturedEvents />
        </div>
      </div>

      {/* Scroll indicator */}
      <button
        onClick={scrollToEvents}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-stone-800 hover:text-stone-900 transition-colors animate-bounce"
        aria-label="Scroll to events"
      >
        <span className="text-sm font-medium">See all events</span>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  )
}
