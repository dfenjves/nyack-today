'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Event } from '@prisma/client'
import { Category } from '@prisma/client'
import { categoryLabels } from '@/lib/utils/categories'
import { decodeHtmlEntities } from '@/lib/utils/text'

const toLocalDateInput = (value: Date) => {
  const local = new Date(value)
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
  return local.toISOString().slice(0, 10)
}

const toLocalTimeInput = (value: Date) => {
  const local = new Date(value)
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
  return local.toISOString().slice(11, 16)
}

export default function EditEventPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    venue: '',
    address: '',
    city: 'Nyack',
    isNyackProper: true,
    category: 'OTHER' as Category,
    price: '',
    isFree: false,
    isFamilyFriendly: false,
    sourceUrl: '',
    imageUrl: '',
    isHidden: false,
  })

  const fetchEvent = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/events/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        const loaded = data.event as Event
        setEvent(loaded)

        const startDate = new Date(loaded.startDate)
        const endDate = loaded.endDate ? new Date(loaded.endDate) : null

        setFormData({
          title: decodeHtmlEntities(loaded.title),
          description: loaded.description ? decodeHtmlEntities(loaded.description) : '',
          startDate: toLocalDateInput(startDate),
          startTime: toLocalTimeInput(startDate),
          endDate: endDate ? toLocalDateInput(endDate) : '',
          endTime: endDate ? toLocalTimeInput(endDate) : '',
          venue: decodeHtmlEntities(loaded.venue),
          address: loaded.address ? decodeHtmlEntities(loaded.address) : '',
          city: decodeHtmlEntities(loaded.city),
          isNyackProper: loaded.isNyackProper,
          category: loaded.category,
          price: loaded.price || '',
          isFree: loaded.isFree,
          isFamilyFriendly: loaded.isFamilyFriendly,
          sourceUrl: loaded.sourceUrl,
          imageUrl: loaded.imageUrl || '',
          isHidden: loaded.isHidden,
        })
      } else {
        setError('Failed to load event')
      }
    } catch {
      setError('Failed to load event')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvent()
  }, [params.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const startDateTime = formData.startTime
        ? `${formData.startDate}T${formData.startTime}`
        : `${formData.startDate}T00:00`

      let endDateTime = null
      if (formData.endDate) {
        endDateTime = formData.endTime
          ? `${formData.endDate}T${formData.endTime}`
          : `${formData.endDate}T23:59`
      }

      const response = await fetch(`/api/admin/events/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          startDate: startDateTime,
          endDate: endDateTime,
          price: formData.isFree ? null : formData.price || null,
        }),
      })

      if (response.ok) {
        router.push('/admin/events')
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to update event')
      }
    } catch {
      setError('Failed to update event')
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <p className="text-stone-600">Event not found.</p>
        <Link
          href="/admin/events"
          className="inline-block mt-4 text-stone-500 hover:text-stone-700"
        >
          Back to events
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Edit Event</h1>
        <Link
          href="/admin/events"
          className="text-stone-500 hover:text-stone-700"
        >
          Cancel
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Title *
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => updateField('title', e.target.value)}
            className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Description
          </label>
          <textarea
            rows={3}
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Start Date *
            </label>
            <input
              type="date"
              required
              value={formData.startDate}
              onChange={(e) => updateField('startDate', e.target.value)}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Start Time
            </label>
            <input
              type="time"
              value={formData.startTime}
              onChange={(e) => updateField('startTime', e.target.value)}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => updateField('endDate', e.target.value)}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              End Time
            </label>
            <input
              type="time"
              value={formData.endTime}
              onChange={(e) => updateField('endTime', e.target.value)}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Venue *
          </label>
          <input
            type="text"
            required
            value={formData.venue}
            onChange={(e) => updateField('venue', e.target.value)}
            className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Address
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => updateField('address', e.target.value)}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              City
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => updateField('city', e.target.value)}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isNyackProper"
            checked={formData.isNyackProper}
            onChange={(e) => updateField('isNyackProper', e.target.checked)}
            className="rounded border-stone-300 text-orange-500 focus:ring-orange-500"
          />
          <label htmlFor="isNyackProper" className="text-sm text-stone-700">
            Located in Nyack proper (not surrounding area)
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Category
          </label>
          <select
            value={formData.category}
            onChange={(e) => updateField('category', e.target.value)}
            className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {Object.entries(categoryLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="isFree"
              checked={formData.isFree}
              onChange={(e) => updateField('isFree', e.target.checked)}
              className="rounded border-stone-300 text-orange-500 focus:ring-orange-500"
            />
            <label htmlFor="isFree" className="text-sm text-stone-700">
              This is a free event
            </label>
          </div>
          {!formData.isFree && (
            <input
              type="text"
              placeholder="e.g., $20, $15-$30"
              value={formData.price}
              onChange={(e) => updateField('price', e.target.value)}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isFamilyFriendly"
            checked={formData.isFamilyFriendly}
            onChange={(e) => updateField('isFamilyFriendly', e.target.checked)}
            className="rounded border-stone-300 text-orange-500 focus:ring-orange-500"
          />
          <label htmlFor="isFamilyFriendly" className="text-sm text-stone-700">
            Family-friendly event
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Event URL
          </label>
          <input
            type="url"
            value={formData.sourceUrl}
            onChange={(e) => updateField('sourceUrl', e.target.value)}
            placeholder="https://..."
            className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Image URL
          </label>
          <input
            type="url"
            value={formData.imageUrl}
            onChange={(e) => updateField('imageUrl', e.target.value)}
            placeholder="https://..."
            className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isHidden"
            checked={formData.isHidden}
            onChange={(e) => updateField('isHidden', e.target.checked)}
            className="rounded border-stone-300 text-orange-500 focus:ring-orange-500"
          />
          <label htmlFor="isHidden" className="text-sm text-stone-700">
            Hide event from public view
          </label>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <Link
            href="/admin/events"
            className="px-6 py-2 bg-stone-100 text-stone-700 rounded-lg font-medium hover:bg-stone-200 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
