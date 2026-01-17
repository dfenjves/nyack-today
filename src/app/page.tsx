'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import DateTabs from '@/components/DateTabs'
import FilterBar, { Filters } from '@/components/FilterBar'
import EventList from '@/components/EventList'
import BottomNav from '@/components/BottomNav'
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

      <BottomNav />
    </div>
  )
}
