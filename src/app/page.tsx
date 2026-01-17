'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import DateTabs from '@/components/DateTabs'
import FilterBar, { Filters } from '@/components/FilterBar'
import EventList from '@/components/EventList'
import { DateFilter } from '@/lib/utils/dates'
import { Event } from '@/generated/prisma/client'

// Mock events for initial development
const mockEvents: Event[] = [
  {
    id: '1',
    title: 'Jazz Night at Maureen\'s',
    description: 'Live jazz performance featuring local musicians',
    startDate: new Date(),
    endDate: null,
    venue: 'Maureen\'s Jazz Cellar',
    address: '2 N Broadway',
    city: 'Nyack',
    isNyackProper: true,
    category: 'MUSIC',
    price: '$15',
    isFree: false,
    isFamilyFriendly: false,
    sourceUrl: 'https://example.com',
    sourceName: 'Visit Nyack',
    imageUrl: null,
    isHidden: false,
    sourceHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    title: 'Comedy Night with Anthony Rodia',
    description: 'Stand-up comedy show',
    startDate: new Date(),
    endDate: null,
    venue: 'Levity Live',
    address: '4210 Palisades Center Dr',
    city: 'West Nyack',
    isNyackProper: false,
    category: 'COMEDY',
    price: '$25-$45',
    isFree: false,
    isFamilyFriendly: false,
    sourceUrl: 'https://levitylive.com',
    sourceName: 'Levity Live',
    imageUrl: null,
    isHidden: false,
    sourceHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '3',
    title: 'Family Movie Night: Paddington',
    description: 'Free outdoor movie screening',
    startDate: new Date(),
    endDate: null,
    venue: 'Memorial Park',
    address: 'Piermont Ave',
    city: 'Nyack',
    isNyackProper: true,
    category: 'MOVIES',
    price: null,
    isFree: true,
    isFamilyFriendly: true,
    sourceUrl: 'https://example.com',
    sourceName: 'Village of Nyack',
    imageUrl: null,
    isHidden: false,
    sourceHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '4',
    title: 'Yoga in the Park',
    description: 'Free community yoga class for all levels',
    startDate: new Date(),
    endDate: null,
    venue: 'Memorial Park',
    address: 'Piermont Ave',
    city: 'Nyack',
    isNyackProper: true,
    category: 'SPORTS_RECREATION',
    price: null,
    isFree: true,
    isFamilyFriendly: true,
    sourceUrl: 'https://example.com',
    sourceName: 'Nyack Parks',
    imageUrl: null,
    isHidden: false,
    sourceHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

export default function Home() {
  const [dateFilter, setDateFilter] = useState<DateFilter>('tonight')
  const [filters, setFilters] = useState<Filters>({
    category: 'ALL',
    priceFilter: 'all',
    location: 'all',
    familyFriendly: false,
  })
  const [events, setEvents] = useState<Event[]>(mockEvents)
  const [loading, setLoading] = useState(false)

  // Filter events based on current filters
  const filteredEvents = events.filter((event) => {
    // Category filter
    if (filters.category !== 'ALL' && event.category !== filters.category) {
      return false
    }

    // Price filter
    if (filters.priceFilter === 'free' && !event.isFree) {
      return false
    }
    if (filters.priceFilter === 'paid' && event.isFree) {
      return false
    }

    // Location filter
    if (filters.location === 'nyack' && !event.isNyackProper) {
      return false
    }
    if (filters.location === 'nearby' && event.isNyackProper) {
      return false
    }

    // Family-friendly filter
    if (filters.familyFriendly && !event.isFamilyFriendly) {
      return false
    }

    return true
  })

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

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-6">
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

        {/* Events list */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
            <p className="text-stone-500 mt-4">Loading events...</p>
          </div>
        ) : (
          <EventList
            events={filteredEvents}
            showDate={dateFilter !== 'tonight' && dateFilter !== 'tomorrow'}
            emptyMessage={
              dateFilter === 'tonight'
                ? "No events tonight"
                : "No events found for this time period"
            }
          />
        )}
      </main>

      {/* Bottom navigation for mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-4 py-2">
        <div className="flex justify-around">
          <a
            href="/"
            className="flex flex-col items-center py-2 px-4 text-orange-500"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="text-xs mt-1">Events</span>
          </a>
          <a
            href="/activities"
            className="flex flex-col items-center py-2 px-4 text-stone-500"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
              />
            </svg>
            <span className="text-xs mt-1">Activities</span>
          </a>
        </div>
      </nav>

      {/* Spacer for mobile bottom nav */}
      <div className="h-16 md:hidden" />
    </div>
  )
}
