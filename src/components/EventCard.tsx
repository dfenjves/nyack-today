import { Event } from '@prisma/client'
import type { Category } from '@prisma/client'
import { formatTime, formatDate } from '@/lib/utils/dates'
import { categoryLabels, getCategoryColor, categoryGradients } from '@/lib/utils/categories'
import { decodeHtmlEntities } from '@/lib/utils/text'
import Link from 'next/link'
import CalendarDropdown from './CalendarDropdown'
import {
  Music, Laugh, Film, Mic2, Baby, UtensilsCrossed,
  Trophy, Building2, Palette, GraduationCap, Calendar,
} from 'lucide-react'

const categoryLucideIcons: Record<Category, React.ReactNode> = {
  MUSIC:                <Music className="w-8 h-8 text-white" />,
  COMEDY:               <Laugh className="w-8 h-8 text-white" />,
  MOVIES:               <Film className="w-8 h-8 text-white" />,
  THEATER:              <Mic2 className="w-8 h-8 text-white" />,
  FAMILY_KIDS:          <Baby className="w-8 h-8 text-white" />,
  FOOD_DRINK:           <UtensilsCrossed className="w-8 h-8 text-white" />,
  SPORTS_RECREATION:    <Trophy className="w-8 h-8 text-white" />,
  COMMUNITY_GOVERNMENT: <Building2 className="w-8 h-8 text-white" />,
  ART_GALLERIES:        <Palette className="w-8 h-8 text-white" />,
  CLASSES_WORKSHOPS:    <GraduationCap className="w-8 h-8 text-white" />,
  OTHER:                <Calendar className="w-8 h-8 text-white" />,
}

interface EventCardProps {
  event: Event
  showDate?: boolean
}

export default function EventCard({ event, showDate = false }: EventCardProps) {
  const startDate = new Date(event.startDate)
  const categoryLabel = categoryLabels[event.category]
  const categoryColor = getCategoryColor(event.category)
  const title = decodeHtmlEntities(event.title)

  return (
    <Link
      href={event.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`block rounded-xl border p-4 transition-all ${
        event.isMarquee
          ? 'bg-cream border-harvest/30 hover:shadow-md hover:border-harvest/60'
          : 'bg-surface border-sand hover:shadow-md hover:border-terra/30'
      }`}
    >
      <div className="flex gap-4">
        {/* Event image or category icon fallback */}
        {event.imageUrl ? (
          <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-oat">
            <img
              src={event.imageUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className={`w-20 h-20 flex-shrink-0 rounded-lg flex items-center justify-center ${categoryGradients[event.category]}`}>
            {categoryLucideIcons[event.category]}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="flex items-center gap-2">
            <h3 className="font-display font-semibold text-ink line-clamp-2 leading-tight">
              {title}
            </h3>
            {event.isMarquee && (
              <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold bg-harvest/20 text-harvest">
                ★ Big Event
              </span>
            )}
          </div>

          {/* Time and date */}
          <p className="text-sm text-stone-600 mt-1">
            {showDate && <span>{formatDate(startDate)} · </span>}
            {formatTime(startDate)}
          </p>

          {/* Venue and location */}
          <p className="text-sm text-muted mt-0.5">
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
              <span className="text-xs text-muted">{event.price}</span>
            ) : null}

            {event.isFamilyFriendly && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                Family
              </span>
            )}

            {event.isRecurring && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                🔁 Recurring
              </span>
            )}

            <div onClick={(e) => e.stopPropagation()}>
              <CalendarDropdown event={event} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
