'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { DayPicker, DateRange } from 'react-day-picker'
import { Drawer } from 'vaul'
import { DateFilter, formatCustomDatePill, getMaxSelectableDate } from '@/lib/utils/dates'
import 'react-day-picker/style.css'

interface CustomRange {
  start: Date
  end: Date
}

interface DateTabsProps {
  activeFilter: DateFilter
  onFilterChange: (filter: DateFilter) => void
  customRange: CustomRange | null
  onCustomRangeSelect: (start: Date, end: Date) => void
  onCustomDateClear: () => void
}

const tabs: { value: DateFilter; label: string }[] = [
  { value: 'tonight', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'weekend', label: 'Weekend' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
]

// Width of the fade at each edge, kept narrow enough that it reads as a hint
// rather than obscuring a whole pill.
const SCROLL_FADE = '28px'

export default function DateTabs({
  activeFilter,
  onFilterChange,
  customRange,
  onCustomRangeSelect,
  onCustomDateClear,
}: DateTabsProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(undefined)
  const maxDate = getMaxSelectableDate()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const updateFades = () => {
      setCanScrollLeft(el.scrollLeft > 1)
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1)
    }

    updateFades()
    el.addEventListener('scroll', updateFades, { passive: true })
    window.addEventListener('resize', updateFades)
    const resizeObserver = new ResizeObserver(updateFades)
    resizeObserver.observe(el)

    return () => {
      el.removeEventListener('scroll', updateFades)
      window.removeEventListener('resize', updateFades)
      resizeObserver.disconnect()
    }
  }, [])

  // Fade the actual pill pixels to transparent at whichever edges still have
  // hidden content, rather than overlaying a solid-color gradient (which
  // shows as a color-mismatched smear over the colored active pill).
  const edgeMask = canScrollLeft && canScrollRight
    ? `linear-gradient(to right, transparent, black ${SCROLL_FADE}, black calc(100% - ${SCROLL_FADE}), transparent)`
    : canScrollRight
      ? `linear-gradient(to right, black calc(100% - ${SCROLL_FADE}), transparent)`
      : canScrollLeft
        ? `linear-gradient(to left, black calc(100% - ${SCROLL_FADE}), transparent)`
        : undefined

  const handleOpenChange = (open: boolean) => {
    setDrawerOpen(open)
    if (open) {
      setPendingRange(customRange ? { from: customRange.start, to: customRange.end } : undefined)
    }
  }

  const handleApply = () => {
    if (pendingRange?.from) {
      onCustomRangeSelect(pendingRange.from, pendingRange.to ?? pendingRange.from)
      setDrawerOpen(false)
    }
  }

  const isCustomActive = !!customRange

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 items-center"
      style={edgeMask ? { WebkitMaskImage: edgeMask, maskImage: edgeMask } : undefined}
    >
      {/* Preset tabs */}
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onFilterChange(tab.value)}
          className={`
            px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors
            ${
              !isCustomActive && activeFilter === tab.value
                ? 'bg-terra text-cream'
                : 'bg-surface text-stone-600 hover:bg-oat border border-sand'
            }
          `}
        >
          {tab.label}
        </button>
      ))}

      {/* Custom tab / active date pill */}
      {customRange ? (
        <div className="flex items-center gap-1 px-3 py-2 rounded-full bg-terra text-cream text-sm font-medium whitespace-nowrap flex-shrink-0">
          <span>{formatCustomDatePill(customRange.start, customRange.end)}</span>
          <button
            onClick={onCustomDateClear}
            className="ml-1 hover:bg-terra/80 rounded-full p-0.5 transition-colors"
            aria-label="Clear custom date"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <Drawer.Root open={drawerOpen} onOpenChange={handleOpenChange}>
          <Drawer.Trigger asChild>
            <button className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors bg-surface text-stone-600 hover:bg-oat border border-sand flex-shrink-0">
              Custom
            </button>
          </Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
            <Drawer.Content className="fixed bottom-0 left-0 right-0 bg-surface rounded-t-2xl z-50 outline-none">
              <Drawer.Title className="sr-only">Pick a Date Range</Drawer.Title>
              <div className="pt-3 flex justify-center">
                <div className="w-10 h-1 bg-sand rounded-full" />
              </div>
              <div className="p-4 pb-8">
                <h3 className="text-base font-display font-semibold text-ink mb-1 text-center">
                  Pick a Date Range
                </h3>
                <p className="text-sm text-muted mb-3 text-center">
                  {pendingRange?.from
                    ? formatCustomDatePill(pendingRange.from, pendingRange.to ?? pendingRange.from)
                    : 'Select a start date, then an end date'}
                </p>
                <div className="flex justify-center">
                  <DayPicker
                    mode="range"
                    selected={pendingRange}
                    onSelect={setPendingRange}
                    disabled={[{ before: today }, { after: maxDate }]}
                    className="rdp-custom"
                  />
                </div>
                <button
                  onClick={handleApply}
                  disabled={!pendingRange?.from}
                  className="w-full mt-2 px-4 py-2.5 rounded-full text-sm font-medium bg-terra text-cream disabled:opacity-40 transition-colors"
                >
                  Apply
                </button>
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      )}
    </div>
  )
}
