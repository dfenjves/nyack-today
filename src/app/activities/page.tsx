'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import ActivityCard from '@/components/ActivityCard'
import BottomNav from '@/components/BottomNav'
import { Category } from '@prisma/client'
import { categoryLabels } from '@/lib/utils/categories'
import { Activity } from '@prisma/client'

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
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchActivities() {
      setLoading(true)
      try {
        const response = await fetch('/api/activities')
        if (response.ok) {
          const data = await response.json()
          setActivities(data.activities)
        }
      } catch (error) {
        console.error('Failed to fetch activities:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchActivities()
  }, [])

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
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🎯</div>
            <p className="text-stone-500">No activities found</p>
            <p className="text-sm text-stone-400 mt-2">
              {activities.length === 0
                ? 'No activities have been added yet'
                : 'Try adjusting your filters'}
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
