'use client'

import { DateFilter } from '@/lib/utils/dates'

interface DateTabsProps {
  activeFilter: DateFilter
  onFilterChange: (filter: DateFilter) => void
}

const tabs: { value: DateFilter; label: string }[] = [
  { value: 'tonight', label: 'Tonight' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'weekend', label: 'Weekend' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
]

export default function DateTabs({ activeFilter, onFilterChange }: DateTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onFilterChange(tab.value)}
          className={`
            px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors
            ${
              activeFilter === tab.value
                ? 'bg-orange-500 text-white'
                : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
            }
          `}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
