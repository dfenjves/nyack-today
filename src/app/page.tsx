'use client'

import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/Header'
import Hero from '@/components/Hero'
import DateTabs from '@/components/DateTabs'
import FilterBar, { Filters } from '@/components/FilterBar'
import EventList from '@/components/EventList'
import { EventListSkeleton } from '@/components/EventCardSkeleton'
import BottomNav from '@/components/BottomNav'
import { DateFilter } from '@/lib/utils/dates'
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

export default function Home() {
  const [dateFilter, setDateFilter] = useState<DateFilter>('tonight')
  const [filters, setFilters] = useState<Filters>({
    category: 'ALL',
    priceFilter: 'all',
    location: 'all',
    familyFriendly: false,
  })
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Build query string from filters
  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams()

    // Date filter
    params.set('date', dateFilter)

    // Category filter
    if (filters.category !== 'ALL') {
      params.set('category', filters.category)
    }

    // Price filter
    if (filters.priceFilter === 'free') {
      params.set('free', 'true')
    }

    // Location filter
    if (filters.location === 'nyack') {
      params.set('nyackOnly', 'true')
    } else if (filters.location === 'nearby') {
      params.set('nearbyOnly', 'true')
    }

    // Family-friendly filter
    if (filters.familyFriendly) {
      params.set('familyFriendly', 'true')
    }

    return params.toString()
  }, [dateFilter, filters])

  // Fetch events from API
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

      // Convert date strings back to Date objects
      const eventsWithDates = data.events.map((event) => ({
        ...event,
        startDate: new Date(event.startDate),
        endDate: event.endDate ? new Date(event.endDate) : null,
        createdAt: new Date(event.createdAt),
        updatedAt: new Date(event.updatedAt),
      }))

      setEvents(eventsWithDates)
    } catch (err) {
      console.error('Error fetching events:', err)
      setError('Failed to load events. Please try again.')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [buildQueryString])

  // Fetch events when filters change
  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // Get the heading based on date filter
  const getHeading = () => {
    switch (dateFilter) {
      case 'tonight':
        return "What's Happening Tonight"
      case 'tomorrow':
        return "Tomorrow's Events"
      case 'weekend':
        return 'This Weekend'
      case 'week':
        return 'This Week'
      default:
        return 'Events'
    }
  }

  // Get empty message based on filters
  const getEmptyMessage = () => {
    if (dateFilter === 'tonight') {
      return "No events tonight"
    }
    if (filters.familyFriendly) {
      return "No family-friendly events found for this time period"
    }
    if (filters.priceFilter === 'free') {
      return "No free events found for this time period"
    }
    return "No events found for this time period"
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <Hero />

      <main id="events-section" className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero section */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-stone-900 mb-2">
            {getHeading()}
          </h1>
          <p className="text-stone-600">
            Discover events and activities in Nyack and the surrounding area
          </p>
        </div>

        {/* Date tabs */}
        <div className="mb-4">
          <DateTabs activeFilter={dateFilter} onFilterChange={setDateFilter} />
        </div>

        {/* Filters */}
        <div className="mb-6">
          <FilterBar filters={filters} onFiltersChange={setFilters} />
        </div>

        {/* Error state */}
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

        {/* Events list */}
        {!error && (
          loading ? (
            <EventListSkeleton count={5} />
          ) : (
            <EventList
              events={events}
              showDate={dateFilter !== 'tonight' && dateFilter !== 'tomorrow'}
              emptyMessage={getEmptyMessage()}
            />
          )
        )}
      </main>

      <BottomNav />
    </div>
  )
}
