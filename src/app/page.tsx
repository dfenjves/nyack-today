'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Header from '@/components/Header'
import Hero from '@/components/Hero'
import MarqueeSection from '@/components/MarqueeSection'
import DateTabs from '@/components/DateTabs'
import FilterBar, { Filters } from '@/components/FilterBar'
import EventList from '@/components/EventList'
import { EventListSkeleton } from '@/components/EventCardSkeleton'
import BottomNav from '@/components/BottomNav'
import FallbackBanner from '@/components/FallbackBanner'
import { DateFilter, formatCustomDatePill } from '@/lib/utils/dates'
import { Event } from '@prisma/client'

interface EventsApiResponse {
  events: Event[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

function convertEventDates(events: Event[]): Event[] {
  return events.map((event) => ({
    ...event,
    startDate: new Date(event.startDate),
    endDate: event.endDate ? new Date(event.endDate) : null,
    createdAt: new Date(event.createdAt),
    updatedAt: new Date(event.updatedAt),
  }))
}

function isFallbackDismissed(): boolean {
  try {
    return sessionStorage.getItem('tonight-fallback-dismissed') === 'true'
  } catch {
    return false
  }
}

export default function Home() {
  const [dateFilter, setDateFilter] = useState<DateFilter>('tonight')
  const [customDate, setCustomDate] = useState<Date | null>(null)
  const [filters, setFilters] = useState<Filters>({
    category: 'ALL',
    priceFilter: 'all',
    location: 'all',
    familyFriendly: false,
  })
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showFallback, setShowFallback] = useState(false)
  const [marqueeOnly, setMarqueeOnly] = useState(false)

  // Signals that the next 'week' fetch was triggered by tonight being empty
  const pendingFallbackRef = useRef(false)

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams()

    if (marqueeOnly) {
      params.set('marquee', 'true')
      // No date param → API defaults to all future events
      return params.toString()
    }

    if (customDate) {
      params.set('date', 'custom')
      params.set('customDate', customDate.toISOString())
    } else {
      params.set('date', dateFilter)
    }

    if (filters.category !== 'ALL') {
      params.set('category', filters.category)
    }
    if (filters.priceFilter === 'free') {
      params.set('free', 'true')
    }
    if (filters.location === 'nyack') {
      params.set('nyackOnly', 'true')
    } else if (filters.location === 'nearby') {
      params.set('nearbyOnly', 'true')
    }
    if (filters.familyFriendly) {
      params.set('familyFriendly', 'true')
    }

    return params.toString()
  }, [dateFilter, filters, customDate, marqueeOnly])

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const queryString = buildQueryString()
      const response = await fetch(`/api/events?${queryString}`)

      if (!response.ok) {
        throw new Error('Failed to fetch events')
      }

      const data: EventsApiResponse = await response.json()
      const eventsWithDates = convertEventDates(data.events)

      // Tonight is empty → switch to This Week tab and show fallback banner
      if (
        dateFilter === 'tonight' &&
        !customDate &&
        eventsWithDates.length === 0 &&
        !isFallbackDismissed()
      ) {
        pendingFallbackRef.current = true
        setDateFilter('week')
        return // re-fetch will be triggered by dateFilter change
      }

      // If this fetch was the result of a fallback from tonight, show the banner
      if (pendingFallbackRef.current && dateFilter === 'week') {
        pendingFallbackRef.current = false
        setShowFallback(true)
      } else {
        setShowFallback(false)
      }

      setEvents(eventsWithDates)
    } catch (err) {
      console.error('Error fetching events:', err)
      setError('Failed to load events. Please try again.')
      setEvents([])
      setShowFallback(false)
    } finally {
      setLoading(false)
    }
  }, [buildQueryString, dateFilter, customDate])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const handleShowAllMarquee = useCallback(() => {
    setMarqueeOnly(true)
    pendingFallbackRef.current = false
    setShowFallback(false)
    setTimeout(() => {
      document.getElementById('events-section')?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }, [])

  const handleClearMarquee = () => {
    setMarqueeOnly(false)
  }

  const handleDateFilterChange = (filter: DateFilter) => {
    pendingFallbackRef.current = false
    setShowFallback(false)
    setCustomDate(null)
    setDateFilter(filter)
    setMarqueeOnly(false)
  }

  const handleCustomDateSelect = (date: Date) => {
    setCustomDate(date)
  }

  const handleCustomDateClear = () => {
    setCustomDate(null)
  }

  const handleFallbackDismiss = () => {
    try {
      sessionStorage.setItem('tonight-fallback-dismissed', 'true')
    } catch {
      // sessionStorage unavailable
    }
    setShowFallback(false)
    // Stay on This Week tab — events remain as-is
  }

  const getHeading = () => {
    if (marqueeOnly) return '⭐ Big Events'
    if (customDate) {
      return `Events on ${formatCustomDatePill(customDate)}`
    }
    switch (dateFilter) {
      case 'tonight':
        return "What's Happening Today"
      case 'tomorrow':
        return "Tomorrow's Events"
      case 'weekend':
        return 'This Weekend'
      case 'week':
        return 'This Week'
      case 'month':
        return 'This Month'
      default:
        return 'Events'
    }
  }

  const getEmptyMessage = () => {
    if (customDate) {
      return `No events on ${formatCustomDatePill(customDate)}`
    }
    if (dateFilter === 'tonight') {
      return 'No events tonight'
    }
    if (filters.familyFriendly) {
      return 'No family-friendly events found for this time period'
    }
    if (filters.priceFilter === 'free') {
      return 'No free events found for this time period'
    }
    return 'No events found for this time period'
  }

  const showDate = !!customDate || (dateFilter !== 'tonight' && dateFilter !== 'tomorrow')

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <Hero />

      <main id="events-section" className="max-w-4xl mx-auto px-4 pt-4 pb-12">
        <MarqueeSection onShowAll={handleShowAllMarquee} />

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-stone-900 mb-2">
            {getHeading()}
          </h1>
          <p className="text-stone-600">
            Discover events and activities in Nyack and the surrounding area
          </p>
        </div>

        <div className="mb-4">
          <DateTabs
            activeFilter={marqueeOnly ? 'custom' : dateFilter}
            onFilterChange={handleDateFilterChange}
            customDate={customDate}
            onCustomDateSelect={handleCustomDateSelect}
            onCustomDateClear={handleCustomDateClear}
          />
        </div>

        <div className="mb-6">
          <FilterBar filters={filters} onFiltersChange={setFilters} />
        </div>

        {marqueeOnly && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
            <span className="text-sm text-amber-800 font-medium">Showing all upcoming marquee events</span>
            <button
              onClick={handleClearMarquee}
              className="text-amber-600 hover:text-amber-900 text-sm font-medium"
            >
              ✕ Clear
            </button>
          </div>
        )}

        {showFallback && (
          <FallbackBanner onDismiss={handleFallbackDismiss} />
        )}

        {error && (
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={fetchEvents}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {!error && (
          loading ? (
            <EventListSkeleton count={5} />
          ) : (
            <EventList
              events={events}
              showDate={showDate}
              emptyMessage={getEmptyMessage()}
            />
          )
        )}
      </main>

      <BottomNav />
    </div>
  )
}
