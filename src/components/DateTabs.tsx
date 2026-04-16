'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import { Drawer } from 'vaul'
import { DateFilter, formatCustomDatePill, getMaxSelectableDate } from '@/lib/utils/dates'
import 'react-day-picker/style.css'

interface DateTabsProps {
  activeFilter: DateFilter
  onFilterChange: (filter: DateFilter) => void
  customDate: Date | null
  onCustomDateSelect: (date: Date) => void
  onCustomDateClear: () => void
}

const tabs: { value: DateFilter; label: string }[] = [
  { value: 'tonight', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'weekend', label: 'Weekend' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
]

export default function DateTabs({
  activeFilter,
  onFilterChange,
  customDate,
  onCustomDateSelect,
  onCustomDateClear,
}: DateTabsProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const maxDate = getMaxSelectableDate()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      onCustomDateSelect(date)
      setDrawerOpen(false)
    }
  }

  const isCustomActive = !!customDate

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 items-center">
      {/* Preset tabs */}
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onFilterChange(tab.value)}
          className={`
            px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors
            ${
              !isCustomActive && activeFilter === tab.value
                ? 'bg-orange-500 text-white'
                : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
            }
          `}
        >
          {tab.label}
        </button>
      ))}

      {/* Custom tab / active date pill */}
      {isCustomActive ? (
        <div className="flex items-center gap-1 px-3 py-2 rounded-full bg-orange-500 text-white text-sm font-medium whitespace-nowrap flex-shrink-0">
          <span>{formatCustomDatePill(customDate)}</span>
          <button
            onClick={onCustomDateClear}
            className="ml-1 hover:bg-orange-600 rounded-full p-0.5 transition-colors"
            aria-label="Clear custom date"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
          <Drawer.Trigger asChild>
            <button className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors bg-white text-stone-600 hover:bg-stone-100 border border-stone-200 flex-shrink-0">
              Custom
            </button>
          </Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
            <Drawer.Content className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 outline-none">
              <Drawer.Title className="sr-only">Pick a Date</Drawer.Title>
              <div className="pt-3 flex justify-center">
                <div className="w-10 h-1 bg-stone-200 rounded-full" />
              </div>
              <div className="p-4 pb-8">
                <h3 className="text-base font-semibold text-stone-900 mb-3 text-center">
                  Pick a Date
                </h3>
                <div className="flex justify-center">
                  <DayPicker
                    mode="single"
                    selected={customDate ?? undefined}
                    onSelect={handleDateSelect}
                    disabled={[{ before: today }, { after: maxDate }]}
                    className="rdp-custom"
                  />
                </div>
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      )}
    </div>
  )
}
