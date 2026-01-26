'use client'

import { useEffect, useState } from 'react'
import { Event } from '@prisma/client'
import { formatTime } from '@/lib/utils/dates'

export default function FeaturedEvents() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTonightEvents() {
      try {
        const response = await fetch('/api/events?date=tonight&limit=3')
        if (!response.ok) throw new Error('Failed to fetch')
        const data = await response.json()

        const eventsWithDates = data.events.map((event: Event) => ({
          ...event,
          startDate: new Date(event.startDate),
          endDate: event.endDate ? new Date(event.endDate) : null,
        }))

        setEvents(eventsWithDates)
      } catch (error) {
        console.error('Error fetching featured events:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTonightEvents()
  }, [])

  if (loading) {
    return (
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-xl p-8 text-center">
        <p className="text-stone-700 text-lg">
          No events tonight — check out tomorrow&rsquo;s events below!
        </p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-stone-900 mb-6 text-center">
        Tonight&rsquo;s Featured Events
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {events.map((event) => (
          <div
            key={event.id}
            className="bg-white/90 backdrop-blur-sm rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
          >
            {event.imageUrl && (
              <div className="h-48 bg-stone-200 relative">
                <img
                  src={event.imageUrl}
                  alt={event.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="p-4">
              <h3 className="font-bold text-stone-900 mb-1 line-clamp-2">
                {event.title}
              </h3>
              <p className="text-sm text-stone-600 mb-2">{event.venue}</p>
              <p className="text-sm text-orange-600 font-medium">
                {formatTime(event.startDate)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
