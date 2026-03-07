'use client'

import FeaturedEvents from './FeaturedEvents'

export default function Hero() {
  return (
    <div className="relative min-h-[70vh] flex flex-col">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-200 via-amber-300 to-orange-400 -z-10" />

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-6xl mx-auto w-full">
        {/* Hero headline */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-bold text-stone-900 mb-3">
            Nyack Today
          </h1>
          <p className="text-lg md:text-xl text-stone-800">
            Your guide to what's happening in our corner of the Hudson Valley
          </p>
        </div>

        {/* Tonight's featured events */}
        <div className="w-full">
          <FeaturedEvents />
        </div>
      </div>
    </div>
  )
}
