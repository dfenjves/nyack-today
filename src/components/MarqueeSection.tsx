'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Event } from '@prisma/client'
import type { Category } from '@prisma/client'
import { formatTime, formatDate } from '@/lib/utils/dates'
import { categoryLabels, getCategoryColor, categoryGradients } from '@/lib/utils/categories'
import { decodeHtmlEntities } from '@/lib/utils/text'
import {
  Music, Laugh, Film, Mic2, Baby, UtensilsCrossed,
  Trophy, Building2, Palette, GraduationCap, Calendar,
} from 'lucide-react'

const categoryLucideIcons: Record<Category, React.ReactNode> = {
  MUSIC:                <Music className="w-10 h-10 text-white" />,
  COMEDY:               <Laugh className="w-10 h-10 text-white" />,
  MOVIES:               <Film className="w-10 h-10 text-white" />,
  THEATER:              <Mic2 className="w-10 h-10 text-white" />,
  FAMILY_KIDS:          <Baby className="w-10 h-10 text-white" />,
  FOOD_DRINK:           <UtensilsCrossed className="w-10 h-10 text-white" />,
  SPORTS_RECREATION:    <Trophy className="w-10 h-10 text-white" />,
  COMMUNITY_GOVERNMENT: <Building2 className="w-10 h-10 text-white" />,
  ART_GALLERIES:        <Palette className="w-10 h-10 text-white" />,
  CLASSES_WORKSHOPS:    <GraduationCap className="w-10 h-10 text-white" />,
  OTHER:                <Calendar className="w-10 h-10 text-white" />,
}

interface MarqueeSectionProps {
  onShowAll: () => void
}

function convertDates(events: Event[]): Event[] {
  return events.map((e) => ({
    ...e,
    startDate: new Date(e.startDate),
    endDate: e.endDate ? new Date(e.endDate) : null,
    createdAt: new Date(e.createdAt),
    updatedAt: new Date(e.updatedAt),
  }))
}

export default function MarqueeSection({ onShowAll }: MarqueeSectionProps) {
  const [events, setEvents] = useState<Event[]>([])
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/events?marquee=true&limit=9')
      .then((r) => r.json())
      .then((data) => {
        const evts = convertDates(data.events ?? [])
        setEvents(evts)
        setAtEnd(evts.length <= 3)
      })
      .catch(() => {})
  }, [])

  const updateArrows = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setAtStart(el.scrollLeft <= 4)
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4)
  }, [])

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -scrollRef.current.clientWidth, behavior: 'smooth' })
  }

  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: scrollRef.current.clientWidth, behavior: 'smooth' })
  }

  if (events.length === 0) return null

  return (
    <div className="mb-8 bg-cream border border-harvest/30 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-harvest uppercase tracking-widest">
          ★ Big Events
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={onShowAll}
            className="text-sm text-terra hover:text-terra/70 font-medium"
          >
            See all →
          </button>
          {events.length > 3 && (
            <div className="flex gap-1">
              <button
                onClick={scrollLeft}
                disabled={atStart}
                className="w-7 h-7 rounded-full bg-oat border border-sand flex items-center justify-center text-stone-600 text-lg leading-none hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                aria-label="Previous"
              >
                ‹
              </button>
              <button
                onClick={scrollRight}
                disabled={atEnd}
                className="w-7 h-7 rounded-full bg-oat border border-sand flex items-center justify-center text-stone-600 text-lg leading-none hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                aria-label="Next"
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={updateArrows}
        className="flex gap-3 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {events.map((event) => {
          const title = decodeHtmlEntities(event.title)
          const label = categoryLabels[event.category]
          const color = getCategoryColor(event.category)
          const startDate = new Date(event.startDate)

          return (
            <Link
              key={event.id}
              href={event.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 w-[calc(33.333%-8px)] min-w-[200px] bg-surface border border-sand rounded-xl p-3 hover:shadow-md hover:border-terra/30 transition-all flex flex-col"
            >
              {event.imageUrl ? (
                <div className="w-full aspect-video rounded-lg overflow-hidden bg-oat mb-3">
                  <img src={event.imageUrl} alt={title} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className={`w-full aspect-video rounded-lg flex items-center justify-center mb-3 ${categoryGradients[event.category]}`}>
                  {categoryLucideIcons[event.category]}
                </div>
              )}

              <h3 className="font-display font-semibold text-ink line-clamp-2 leading-tight text-sm flex-1">
                {title}
              </h3>
              <p className="text-xs text-muted mt-1">
                {formatDate(startDate)} · {formatTime(startDate)}
              </p>
              <p className="text-xs text-muted truncate mt-0.5">
                {decodeHtmlEntities(event.venue)}
              </p>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium ${color}`}>
                  {label}
                </span>
                {event.isFree && (
                  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                    Free
                  </span>
                )}
                {event.isFamilyFriendly && (
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                    Family
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
