'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import { Drawer } from 'vaul'
import { DateFilter, formatCustomDatePill, getMaxSelectableDate } from '@/lib/utils/dates'
import 'react-day-picker/style.css'

const DATE_TABS: { value: DateFilter; label: string }[] = [
  { value: 'tonight', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'weekend', label: 'Weekend' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
]

const DATE_PILL_LABELS: Record<DateFilter | 'custom', string> = {
  tonight: 'Happening today',
  tomorrow: 'Happening tomorrow',
  weekend: 'This weekend in Nyack',
  week: 'Happening this week',
  month: 'This month in Nyack',
  custom: 'Custom date',
}

export const CATEGORY_FILTERS = ['All', 'Music', 'Food & Drink', 'Family', 'Art', 'Community', 'Free', 'Outdoors']

interface HeroProps {
  dateFilter: DateFilter
  onDateFilterChange: (filter: DateFilter) => void
  quickFilter: string
  onQuickFilterChange: (filter: string) => void
  customDate: Date | null
  onCustomDateSelect: (date: Date) => void
  onCustomDateClear: () => void
}

export default function Hero({
  dateFilter,
  onDateFilterChange,
  quickFilter,
  onQuickFilterChange,
  customDate,
  onCustomDateSelect,
  onCustomDateClear,
}: HeroProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const maxDate = getMaxSelectableDate()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const pillLabel = customDate
    ? formatCustomDatePill(customDate)
    : DATE_PILL_LABELS[dateFilter]

  const chipBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    padding: '7px 14px',
    borderRadius: 20,
    cursor: 'pointer',
    border: '0.5px solid',
    userSelect: 'none',
    transition: 'all 0.15s',
    fontWeight: 400,
    whiteSpace: 'nowrap',
    fontFamily: 'inherit',
    background: 'transparent',
  }

  const chipActive: React.CSSProperties = {
    background: '#D4622A',
    color: '#FEF0E6',
    borderColor: '#D4622A',
  }

  const chipInactive: React.CSSProperties = {
    background: 'rgba(245,240,232,0.10)',
    color: '#C5DFC9',
    borderColor: 'rgba(245,240,232,0.20)',
  }

  return (
    <section
      style={{
        background: '#1E3A2F',
        padding: '56px 32px 56px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Organic blob accent */}
      <svg
        width="420"
        height="420"
        viewBox="0 0 360 360"
        style={{ position: 'absolute', right: -80, top: -60, pointerEvents: 'none', opacity: 1 }}
        aria-hidden="true"
      >
        <ellipse cx="180" cy="170" rx="150" ry="115" fill="#8FBD9E" opacity="0.18" transform="rotate(18 180 170)" />
        <ellipse cx="225" cy="135" rx="80" ry="65" fill="#F5F0E8" opacity="0.12" />
        <ellipse cx="120" cy="220" rx="50" ry="40" fill="#D4622A" opacity="0.18" />
        <circle cx="265" cy="220" r="22" fill="#C8973A" opacity="0.25" />
      </svg>

      <div className="max-w-[1100px] mx-auto" style={{ position: 'relative' }}>
        {/* Date pill */}
        <div style={{ marginBottom: 16 }}>
          <span
            style={{
              display: 'inline-block',
              background: '#D4622A',
              color: '#FEF0E6',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              padding: '5px 10px',
              borderRadius: 12,
              fontWeight: 500,
            }}
          >
            {pillLabel}
          </span>
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(38px, 5vw, 56px)',
            fontWeight: 600,
            color: '#F5F0E8',
            lineHeight: 1.05,
            maxWidth: 600,
            letterSpacing: '-0.025em',
            marginBottom: 14,
          }}
        >
          What&rsquo;s on in Nyack.
        </h1>

        <p
          style={{
            fontSize: 16,
            color: '#8FBD9E',
            maxWidth: 460,
            lineHeight: 1.55,
            marginBottom: 28,
          }}
        >
          Your corner of the Hudson Valley — live and local. Updated daily.
        </p>

        {/* Date chips */}
        <div className="flex flex-wrap gap-2 mb-3">
          {DATE_TABS.map((tab) => {
            const active = !customDate && dateFilter === tab.value
            return (
              <button
                key={tab.value}
                onClick={() => { onDateFilterChange(tab.value); onCustomDateClear() }}
                style={{ ...chipBase, ...(active ? chipActive : chipInactive) }}
              >
                {tab.label}
              </button>
            )
          })}

          {customDate ? (
            <div
              style={{ ...chipBase, ...chipActive, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <span>{formatCustomDatePill(customDate)}</span>
              <button
                onClick={onCustomDateClear}
                aria-label="Clear custom date"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 4px', color: 'inherit', display: 'flex' }}
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
              <Drawer.Trigger asChild>
                <button style={{ ...chipBase, ...chipInactive }}>Custom</button>
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
                        onSelect={(date) => { if (date) { onCustomDateSelect(date); setDrawerOpen(false) } }}
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

        {/* Category chips */}
        <div className="flex flex-wrap gap-2">
          {CATEGORY_FILTERS.map((f) => {
            const active = quickFilter === f
            return (
              <button
                key={f}
                onClick={() => onQuickFilterChange(f)}
                style={{ ...chipBase, ...(active ? chipActive : chipInactive) }}
              >
                {f}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
