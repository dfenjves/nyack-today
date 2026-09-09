'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Hero from '@/components/Hero'
import DateTabs from '@/components/DateTabs'
import FilterBar, { Filters } from '@/components/FilterBar'
import EventList from '@/components/EventList'
import { EventListSkeleton } from '@/components/EventCardSkeleton'
import BottomNav from '@/components/BottomNav'
import FallbackBanner from '@/components/FallbackBanner'
import SubscribeSection from '@/components/SubscribeSection'
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

interface CustomRange {
  start: Date
  end: Date
}

interface HomeClientProps {
  initialEvents: Event[]
  initialDateFilter: DateFilter
  initialCustomRange: { start: string; end: string } | null
  initialFilters: Filters
  initialShowFallback: boolean
}

export default function HomeClient({
  initialEvents,
  initialDateFilter,
  initialCustomRange,
  initialFilters,
  initialShowFallback,
}: HomeClientProps) {
  const router = useRouter()
  const [dateFilter, setDateFilter] = useState<DateFilter>(initialDateFilter)
  const [customRange, setCustomRange] = useState<CustomRange | null>(
    initialCustomRange
      ? { start: new Date(initialCustomRange.start), end: new Date(initialCustomRange.end) }
      : null
  )
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [events, setEvents] = useState<Event[]>(() => convertEventDates(initialEvents))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showFallback, setShowFallback] = useState(initialShowFallback)

  // Skip the initial fetch — we already have server-rendered data
  const isInitialMount = useRef(true)
  const isInitialUrlSync = useRef(true)
  const pendingFallbackRef = useRef(false)

  // Server can't read sessionStorage — hide banner if user previously dismissed it
  useEffect(() => {
    if (initialShowFallback && isFallbackDismissed()) {
      setShowFallback(false)
    }
  }, [initialShowFallback])

  // Lets the event detail page's back button know it can safely use
  // router.back() (which restores this page's filter state) instead of
  // pushing a fresh "/" navigation (which would reset to "tonight").
  useEffect(() => {
    try {
      sessionStorage.setItem('nyack-visited-home', 'true')
    } catch {
      // sessionStorage unavailable
    }
  }, [])

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams()

    if (customRange) {
      params.set('date', 'custom')
      params.set('customStart', customRange.start.toISOString())
      params.set('customEnd', customRange.end.toISOString())
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
  }, [dateFilter, filters, customRange])

  // Keep the URL in sync with the current filters via the Next.js router (rather
  // than raw History API calls, which leave Next's own router state out of sync
  // and get overridden on back navigation) so that navigating to an event and
  // back — which forces a fresh server render of this dynamic page — restores
  // the same view instead of resetting to tonight. The initial render's URL
  // already matches (it came from the server), so skip that render to avoid a
  // redundant replace.
  useEffect(() => {
    if (isInitialUrlSync.current) {
      isInitialUrlSync.current = false
      return
    }
    const queryString = buildQueryString()
    router.replace(`/?${queryString}`, { scroll: false })
  }, [buildQueryString, router])

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
        !customRange &&
        eventsWithDates.length === 0 &&
        !isFallbackDismissed()
      ) {
        pendingFallbackRef.current = true
        setDateFilter('week')
        return
      }

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
  }, [buildQueryString, dateFilter, customRange])

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    fetchEvents()
  }, [fetchEvents])

  const handleDateFilterChange = (filter: DateFilter) => {
    pendingFallbackRef.current = false
    setShowFallback(false)
    setCustomRange(null)
    setDateFilter(filter)
  }

  const handleCustomRangeSelect = (start: Date, end: Date) => {
    setCustomRange({ start, end })
  }

  const handleCustomDateClear = () => {
    setCustomRange(null)
  }

  const handleFallbackDismiss = () => {
    try {
      sessionStorage.setItem('tonight-fallback-dismissed', 'true')
    } catch {
      // sessionStorage unavailable
    }
    setShowFallback(false)
  }

  const getHeading = () => {
    if (customRange) {
      const isSingleDay = customRange.start.toDateString() === customRange.end.toDateString()
      const label = formatCustomDatePill(customRange.start, customRange.end)
      return isSingleDay ? `Events on ${label}` : `Events ${label}`
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
    if (customRange) {
      const isSingleDay = customRange.start.toDateString() === customRange.end.toDateString()
      const label = formatCustomDatePill(customRange.start, customRange.end)
      return isSingleDay ? `No events on ${label}` : `No events ${label}`
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

  return (
    <div className="min-h-screen">
      <Header />
      <Hero />

      <main id="events-section" className="max-w-4xl mx-auto px-4 pt-3 pb-12">
        <div className="mb-6">
          <h1 className="font-display font-semibold text-3xl text-ink mb-2">
            {getHeading()}
          </h1>
          <p className="text-muted text-sm">
            Discover events and activities in Nyack and the surrounding area
          </p>
        </div>

        <div className="mb-4">
          <DateTabs
            activeFilter={dateFilter}
            onFilterChange={handleDateFilterChange}
            customRange={customRange}
            onCustomRangeSelect={handleCustomRangeSelect}
            onCustomDateClear={handleCustomDateClear}
          />
        </div>

        <div className="mb-6">
          <FilterBar filters={filters} onFiltersChange={setFilters} />
        </div>

        {showFallback && (
          <FallbackBanner onDismiss={handleFallbackDismiss} />
        )}

        {error && (
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={fetchEvents}
              className="px-4 py-2 bg-terra text-cream rounded-lg hover:bg-terra/90 transition-colors"
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
              showDate={true}
              emptyMessage={getEmptyMessage()}
            />
          )
        )}

        <div id="subscribe-section" className="mt-10">
          <SubscribeSection />
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
