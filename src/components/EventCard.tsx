import { Event } from '@/generated/prisma/client'
import { formatTime, formatDate } from '@/lib/utils/dates'
import { categoryIcons, categoryLabels, getCategoryColor } from '@/lib/utils/categories'
import { decodeHtmlEntities } from '@/lib/utils/text'
import Link from 'next/link'

interface EventCardProps {
  event: Event
  showDate?: boolean
}

export default function EventCard({ event, showDate = false }: EventCardProps) {
  const startDate = new Date(event.startDate)
  const categoryIcon = categoryIcons[event.category]
  const categoryLabel = categoryLabels[event.category]
  const categoryColor = getCategoryColor(event.category)
  const title = decodeHtmlEntities(event.title)

  return (
    <Link
      href={event.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white rounded-xl border border-stone-200 p-4 hover:shadow-md hover:border-orange-200 transition-all"
    >
      <div className="flex gap-4">
        {/* Event image or category icon fallback */}
        {event.imageUrl ? (
          <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-stone-100">
            <img
              src={event.imageUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-20 h-20 flex-shrink-0 rounded-lg bg-orange-50 flex items-center justify-center text-3xl">
            {categoryIcon}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="font-semibold text-stone-900 line-clamp-2 leading-tight">
            {title}
          </h3>

          {/* Time and date */}
          <p className="text-sm text-stone-600 mt-1">
            {showDate && <span>{formatDate(startDate)} · </span>}
            {formatTime(startDate)}
          </p>

          {/* Venue and location */}
          <p className="text-sm text-stone-500 mt-0.5">
            {event.venue}
            {event.city !== 'Nyack' && <span> · {event.city}</span>}
          </p>

          {/* Bottom row: category, price, badges */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryColor}`}>
              {categoryLabel}
            </span>

            {event.isFree ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                Free
              </span>
            ) : event.price ? (
              <span className="text-xs text-stone-500">{event.price}</span>
            ) : null}

            {event.isFamilyFriendly && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                Family
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
