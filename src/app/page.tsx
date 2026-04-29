'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Header from '@/components/Header'
import Hero from '@/components/Hero'
import MarqueeSection from '@/components/MarqueeSection'
import EventList from '@/components/EventList'
import { EventListSkeleton } from '@/components/EventCardSkeleton'
import BottomNav from '@/components/BottomNav'
import Footer from '@/components/Footer'
import SubscribeSection from '@/components/SubscribeSection'
import { DateFilter } from '@/lib/utils/dates'
import { Event } from '@prisma/client'
import { Category } from '@prisma/client'

const QUICK_FILTER_MAP: Record<string, Partial<{ category: Category; free: boolean; familyFriendly: boolean }>> = {
  Music:         { category: 'MUSIC' },
  'Food & Drink':{ category: 'FOOD_DRINK' },
  Family:        { familyFriendly: true },
  Art:           { category: 'ART_GALLERIES' },
  Community:     { category: 'COMMUNITY_GOVERNMENT' },
  Free:          { free: true },
  Outdoors:      { category: 'SPORTS_RECREATION' },
}

const DATE_TAB_LABELS: Record<DateFilter, string> = {
  tonight: 'Today',
  tomorrow: 'Tomorrow',
  weekend: 'Weekend',
  week: 'This Week',
  month: 'This Month',
  custom: 'Custom',
}

interface EventsApiResponse {
  events: Event[]
  pagination: { total: number; limit: number; offset: number; hasMore: boolean }
}

function convertEventDates(events: Event[]): Event[] {
  return events.map((event) => ({
    ...event,
    startDate: new Date(event.startDate),
    endDate: event.endDate ? new Date(event.endDate) : null,
    createdAt: new Date(event.createdAt),
    updatedAt: new Date(event.updatedAt),
  }))
}

function isFallbackDismissed(): boolean {
  try { return sessionStorage.getItem('tonight-fallback-dismissed') === 'true' } catch { return false }
}

export default function Home() {
  const [dateFilter, setDateFilter] = useState<DateFilter>('tonight')
  const [customDate, setCustomDate] = useState<Date | null>(null)
  const [quickFilter, setQuickFilter] = useState('All')
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showFallback, setShowFallback] = useState(false)

  const pendingFallbackRef = useRef(false)

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams()

    if (customDate) {
      params.set('date', 'custom')
      params.set('customDate', customDate.toISOString())
    } else {
      params.set('date', dateFilter)
    }

    const mapping = QUICK_FILTER_MAP[quickFilter]
    if (mapping) {
      if (mapping.category) params.set('category', mapping.category)
      if (mapping.free) params.set('free', 'true')
      if (mapping.familyFriendly) params.set('familyFriendly', 'true')
    }

    return params.toString()
  }, [dateFilter, quickFilter, customDate])

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const queryString = buildQueryString()
      const response = await fetch(`/api/events?${queryString}`)

      if (!response.ok) throw new Error('Failed to fetch events')

      const data: EventsApiResponse = await response.json()
      const eventsWithDates = convertEventDates(data.events)

      if (
        dateFilter === 'tonight' &&
        !customDate &&
        eventsWithDates.length === 0 &&
        !isFallbackDismissed()
      ) {
        pendingFallbackRef.current = true
        setDateFilter('week')
        return
      }

      if (pendingFallbackRef.current && dateFilter === 'week') {
        pendingFallbackRef.current = false
        setShowFallback(true)
      } else {
        setShowFallback(false)
      }

      setEvents(eventsWithDates)
    } catch (err) {
      console.error('Error fetching events:', err)
      setError('Failed to load events. Please try again.')
      setEvents([])
      setShowFallback(false)
    } finally {
      setLoading(false)
    }
  }, [buildQueryString, dateFilter, customDate])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const handleDateFilterChange = (filter: DateFilter) => {
    pendingFallbackRef.current = false
    setShowFallback(false)
    setCustomDate(null)
    setDateFilter(filter)
  }

  const handleCustomDateSelect = (date: Date) => setCustomDate(date)
  const handleCustomDateClear = () => setCustomDate(null)

  const getEmptyMessage = () => {
    const dateLabel = customDate ? 'that date' : DATE_TAB_LABELS[dateFilter]?.toLowerCase() || 'this period'
    if (quickFilter !== 'All') return `No ${quickFilter.toLowerCase()} events for ${dateLabel}`
    return `No events for ${dateLabel}`
  }

  const showDate = !!customDate || (dateFilter !== 'tonight' && dateFilter !== 'tomorrow')

  const comingUpLabel =
    quickFilter !== 'All'
      ? `${events.length} ${events.length === 1 ? 'event' : 'events'} in ${quickFilter}`
      : `${events.length} ${events.length === 1 ? 'event' : 'events'}`

  const comingUpEyebrow = `Coming up · ${DATE_TAB_LABELS[dateFilter] || ''}`

  return (
    <div className="min-h-screen">
      <Header />

      <Hero
        dateFilter={dateFilter}
        onDateFilterChange={handleDateFilterChange}
        quickFilter={quickFilter}
        onQuickFilterChange={setQuickFilter}
        customDate={customDate}
        onCustomDateSelect={handleCustomDateSelect}
        onCustomDateClear={handleCustomDateClear}
      />

      <main id="events-section" style={{ background: '#F5F0E8' }}>
        <div
          className="max-w-[1100px] mx-auto"
          style={{ padding: 'clamp(28px, 5vw, 48px) clamp(20px, 4vw, 48px) clamp(40px, 6vw, 56px)' }}
        >
          {/* Big events section */}
          <MarqueeSection />

          {/* Coming up section */}
          <div style={{ marginBottom: 'clamp(36px, 5vw, 56px)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16, gap: 16 }}>
              <div>
                <p style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A7468', marginBottom: 6, fontWeight: 500 }}>
                  {comingUpEyebrow}
                </p>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: '#1A1A14', letterSpacing: '-0.01em', lineHeight: 1.2, margin: 0 }}>
                  {comingUpLabel}
                </h2>
              </div>
            </div>

            {showFallback && (
              <div
                style={{
                  background: '#FDF8F0',
                  border: '0.5px solid #DDD6C6',
                  borderRadius: 12,
                  padding: '10px 16px',
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: 13, color: '#7A7468' }}>Nothing on tonight — showing this week instead.</span>
                <button
                  onClick={() => {
                    try { sessionStorage.setItem('tonight-fallback-dismissed', 'true') } catch {}
                    setShowFallback(false)
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D4622A', fontSize: 12, fontWeight: 500, fontFamily: 'inherit' }}
                >
                  Dismiss
                </button>
              </div>
            )}

            {error ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <p style={{ color: '#A24A3D', marginBottom: 12, fontSize: 13 }}>{error}</p>
                <button
                  onClick={fetchEvents}
                  style={{ padding: '8px 16px', background: '#D4622A', color: '#FEF0E6', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
                >
                  Try Again
                </button>
              </div>
            ) : loading ? (
              <EventListSkeleton count={5} />
            ) : (
              <EventList events={events} showDate={showDate} emptyMessage={getEmptyMessage()} />
            )}
          </div>

          {/* Subscribe */}
          <SubscribeSection />
        </div>
      </main>

      <Footer />
      <BottomNav />
    </div>
  )
}
