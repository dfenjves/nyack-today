export default function Hero() {
  return (
    <div className="relative bg-forest overflow-hidden">
      {/* Decorative blob */}
      <svg
        className="absolute right-0 top-0 w-72 h-72 pointer-events-none"
        viewBox="0 0 360 360"
        aria-hidden="true"
      >
        <ellipse cx="180" cy="170" rx="150" ry="115" fill="#8FBD9E" opacity="0.12" transform="rotate(18 180 170)" />
        <ellipse cx="225" cy="135" rx="80" ry="65" fill="#F5F0E8" opacity="0.08" />
        <ellipse cx="120" cy="220" rx="50" ry="40" fill="#D4622A" opacity="0.12" />
        <circle cx="265" cy="220" r="22" fill="#C8973A" opacity="0.18" />
      </svg>

      <div className="relative z-10 flex flex-col items-center justify-center px-4 pt-12 pb-6 max-w-4xl mx-auto w-full">
        <p className="text-xs font-medium uppercase tracking-widest text-sage mb-4">
          Nyack, NY
        </p>
        <h1 className="font-display font-semibold text-4xl md:text-6xl text-oat text-center leading-tight tracking-tight mb-3">
          What&apos;s on in Nyack.
        </h1>
        <p className="text-sage text-base md:text-lg text-center max-w-sm">
          Your guide to what&apos;s happening in our corner of the Hudson Valley
        </p>
      </div>
    </div>
  )
}
