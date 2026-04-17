export default function Hero() {
  return (
    <div className="relative">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-200 via-amber-300 to-orange-400 -z-10" />

      {/* Content */}
      <div className="flex flex-col items-center justify-center px-4 pt-8 pb-0 max-w-6xl mx-auto w-full">
        {/* Hero headline */}
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-stone-900 mb-3">
            Nyack Today
          </h1>
          <p className="text-lg md:text-xl text-stone-800">
            Your guide to what&apos;s happening in our corner of the Hudson Valley
          </p>
        </div>
      </div>
    </div>
  )
}
