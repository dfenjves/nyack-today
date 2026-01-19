'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import ActivityCard from '@/components/ActivityCard'
import BottomNav from '@/components/BottomNav'
import { Category } from '@prisma/client'
import { categoryLabels } from '@/lib/utils/categories'
import { Activity } from '@prisma/client'

// Mock activities for initial development
const mockActivities: Activity[] = [
  {
    id: '1',
    title: 'RPM Raceway Go-Karts',
    description: 'Indoor electric go-kart racing at the Palisades Center',
    venue: 'Palisades Center Mall',
    address: '1000 Palisades Center Dr',
    city: 'West Nyack',
    isNyackProper: false,
    category: 'SPORTS_RECREATION',
    price: '$25-$50',
    isFree: false,
    isFamilyFriendly: true,
    hours: 'Mon-Thu 2pm-9pm, Fri-Sun 11am-10pm',
    websiteUrl: 'https://rpmraceway.com',
    imageUrl: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    title: 'Bowlerland Lanes',
    description: 'Classic bowling alley with arcade games',
    venue: 'Bowlerland',
    address: '100 E Main St',
    city: 'Nanuet',
    isNyackProper: false,
    category: 'SPORTS_RECREATION',
    price: '$6-$8 per game',
    isFree: false,
    isFamilyFriendly: true,
    hours: 'Daily 10am-12am',
    websiteUrl: 'https://example.com/bowlerland',
    imageUrl: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '3',
    title: 'Hook Mountain State Park',
    description: 'Scenic hiking trails with Hudson River views',
    venue: 'Hook Mountain',
    address: 'Hook Mountain State Park',
    city: 'Nyack',
    isNyackProper: true,
    category: 'SPORTS_RECREATION',
    price: null,
    isFree: true,
    isFamilyFriendly: true,
    hours: 'Dawn to dusk',
    websiteUrl: 'https://parks.ny.gov/parks/hookmountain',
    imageUrl: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '4',
    title: 'Nyack Beach State Park',
    description: 'Beach, picnic areas, and hiking along the Hudson',
    venue: 'Nyack Beach State Park',
    address: 'Nyack Beach Rd',
    city: 'Nyack',
    isNyackProper: true,
    category: 'SPORTS_RECREATION',
    price: '$8 parking (seasonal)',
    isFree: false,
    isFamilyFriendly: true,
    hours: 'Dawn to dusk',
    websiteUrl: 'https://parks.ny.gov/parks/nyackbeach',
    imageUrl: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '5',
    title: 'Edward Hopper House Museum',
    description: 'Birthplace and museum of the famous American artist',
    venue: 'Edward Hopper House',
    address: '82 N Broadway',
    city: 'Nyack',
    isNyackProper: true,
    category: 'ART_GALLERIES',
    price: '$5 suggested donation',
    isFree: false,
    isFamilyFriendly: true,
    hours: 'Thu-Sun 12pm-5pm',
    websiteUrl: 'https://edwardhopperhouse.org',
    imageUrl: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '6',
    title: 'Strawberry Place',
    description: 'Gourmet chocolate and candy shop',
    venue: 'Strawberry Place',
    address: '72 S Broadway',
    city: 'Nyack',
    isNyackProper: true,
    category: 'FOOD_DRINK',
    price: null,
    isFree: true,
    isFamilyFriendly: true,
    hours: 'Mon-Sat 10am-6pm, Sun 11am-5pm',
    websiteUrl: 'https://strawberryplace.com',
    imageUrl: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

interface ActivityFilters {
  category: Category | 'ALL'
  priceFilter: 'all' | 'free' | 'paid'
  familyFriendly: boolean
}

export default function ActivitiesPage() {
  const [filters, setFilters] = useState<ActivityFilters>({
    category: 'ALL',
    priceFilter: 'all',
    familyFriendly: false,
  })
  const [activities] = useState<Activity[]>(mockActivities)

  // Filter activities based on current filters
  const filteredActivities = activities.filter((activity) => {
    // Category filter
    if (filters.category !== 'ALL' && activity.category !== filters.category) {
      return false
    }

    // Price filter
    if (filters.priceFilter === 'free' && !activity.isFree) {
      return false
    }
    if (filters.priceFilter === 'paid' && activity.isFree) {
      return false
    }

    // Family-friendly filter
    if (filters.familyFriendly && !activity.isFamilyFriendly) {
      return false
    }

    return true
  })

  const updateFilter = <K extends keyof ActivityFilters>(key: K, value: ActivityFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Header section */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-stone-900 mb-2">
            Always Available
          </h1>
          <p className="text-stone-600">
            Things to do anytime in Nyack and the surrounding area
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center mb-6">
          {/* Category filter */}
          <select
            value={filters.category}
            onChange={(e) => updateFilter('category', e.target.value as Category | 'ALL')}
            className="px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="ALL">All Categories</option>
            {Object.entries(categoryLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          {/* Price filter */}
          <select
            value={filters.priceFilter}
            onChange={(e) => updateFilter('priceFilter', e.target.value as ActivityFilters['priceFilter'])}
            className="px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">Any Price</option>
            <option value="free">Free Only</option>
            <option value="paid">Paid Only</option>
          </select>

          {/* Family-friendly toggle */}
          <button
            onClick={() => updateFilter('familyFriendly', !filters.familyFriendly)}
            className={`
              px-3 py-2 rounded-lg text-sm font-medium transition-colors
              ${
                filters.familyFriendly
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
              }
            `}
          >
            Family-Friendly
          </button>
        </div>

        {/* Activities list */}
        {filteredActivities.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🎯</div>
            <p className="text-stone-500">No activities found</p>
            <p className="text-sm text-stone-400 mt-2">
              Try adjusting your filters
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredActivities.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
