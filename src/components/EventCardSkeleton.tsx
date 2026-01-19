/**
 * Skeleton loading state for EventCard
 */
export default function EventCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-4 animate-pulse">
      <div className="flex gap-4">
        {/* Image skeleton */}
        <div className="w-20 h-20 bg-stone-200 rounded-lg flex-shrink-0" />

        {/* Content skeleton */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="h-5 bg-stone-200 rounded w-3/4 mb-2" />

          {/* Time and venue */}
          <div className="h-4 bg-stone-100 rounded w-1/2 mb-2" />

          {/* Tags row */}
          <div className="flex gap-2 mt-2">
            <div className="h-5 bg-stone-100 rounded w-16" />
            <div className="h-5 bg-stone-100 rounded w-12" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Multiple skeleton cards for loading state
 */
export function EventListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  )
}
