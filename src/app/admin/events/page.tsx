'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Event } from '@/generated/prisma/client'
import { categoryLabels } from '@/lib/utils/categories'
import { Category } from '@/generated/prisma/enums'
import { decodeHtmlEntities } from '@/lib/utils/text'

export default function AdminEventsPage() {
  const searchParams = useSearchParams()
  const showHidden = searchParams.get('hidden') === 'true'

  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past' | 'hidden'>(
    showHidden ? 'hidden' : 'upcoming'
  )

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter === 'hidden') {
        params.set('hidden', 'true')
      } else if (filter === 'past') {
        params.set('past', 'true')
      } else if (filter === 'upcoming') {
        params.set('upcoming', 'true')
      }
      params.set('limit', '100')

      const response = await fetch(`/api/admin/events?${params}`)
      if (response.ok) {
        const data = await response.json()
        setEvents(data.events)
      }
    } catch (error) {
      console.error('Failed to fetch events:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [filter])

  const toggleHidden = async (event: Event) => {
    try {
      const response = await fetch(`/api/admin/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isHidden: !event.isHidden }),
      })

      if (response.ok) {
        setEvents((prev) =>
          prev.map((e) =>
            e.id === event.id ? { ...e, isHidden: !e.isHidden } : e
          )
        )
      }
    } catch (error) {
      console.error('Failed to update event:', error)
    }
  }

  const deleteEvent = async (event: Event) => {
    if (!confirm(`Delete "${event.title}"? This cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/events/${event.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== event.id))
      }
    } catch (error) {
      console.error('Failed to delete event:', error)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Events</h1>
        <Link
          href="/admin/events/new"
          className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
        >
          + Add Event
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(['upcoming', 'all', 'past', 'hidden'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-orange-500 text-white'
                : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'hidden' && ' Events'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-stone-200">
          <p className="text-stone-500">No events found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">
                  Event
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600 hidden md:table-cell">
                  Date
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600 hidden md:table-cell">
                  Source
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600 hidden sm:table-cell">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-stone-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {events.map((event) => (
                <tr key={event.id} className={event.isHidden ? 'bg-red-50' : ''}>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-stone-900 line-clamp-1">
                        {decodeHtmlEntities(event.title)}
                      </p>
                      <p className="text-sm text-stone-500">
                        {event.venue}, {event.city}
                      </p>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-stone-100 text-stone-600 text-xs rounded">
                        {categoryLabels[event.category as Category]}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-600 hidden md:table-cell">
                    {new Date(event.startDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-600 hidden md:table-cell">
                    {event.sourceName}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {event.isHidden ? (
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                        Hidden
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                        Visible
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleHidden(event)}
                        className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                          event.isHidden
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                        }`}
                      >
                        {event.isHidden ? 'Show' : 'Hide'}
                      </button>
                      <Link
                        href={`/admin/events/${event.id}`}
                        className="px-3 py-1 bg-stone-100 text-stone-700 text-xs rounded font-medium hover:bg-stone-200 transition-colors"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => deleteEvent(event)}
                        className="px-3 py-1 bg-red-100 text-red-700 text-xs rounded font-medium hover:bg-red-200 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
