'use client'

import { Category } from '@/generated/prisma/enums'
import { categoryLabels } from '@/lib/utils/categories'

export interface Filters {
  category: Category | 'ALL'
  priceFilter: 'all' | 'free' | 'paid'
  location: 'all' | 'nyack' | 'nearby'
  familyFriendly: boolean
}

interface FilterBarProps {
  filters: Filters
  onFiltersChange: (filters: Filters) => void
}

export default function FilterBar({ filters, onFiltersChange }: FilterBarProps) {
  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
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
        onChange={(e) => updateFilter('priceFilter', e.target.value as Filters['priceFilter'])}
        className="px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
      >
        <option value="all">Any Price</option>
        <option value="free">Free Only</option>
        <option value="paid">Paid Only</option>
      </select>

      {/* Location filter */}
      <select
        value={filters.location}
        onChange={(e) => updateFilter('location', e.target.value as Filters['location'])}
        className="px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
      >
        <option value="all">All Locations</option>
        <option value="nyack">Nyack Only</option>
        <option value="nearby">Nearby Areas</option>
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
  )
}
