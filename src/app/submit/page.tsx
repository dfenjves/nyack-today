'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Category } from '@prisma/client'
import { categoryLabels } from '@/lib/utils/categories'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'

export default function SubmitEventPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    // Required fields
    title: '',
    startDate: '',
    startTime: '',
    venue: '',
    submitterEmail: '',

    // Optional fields
    description: '',
    endDate: '',
    endTime: '',
    address: '',
    city: 'Nyack',
    category: 'OTHER' as Category,
    price: '',
    isFree: false,
    isFamilyFriendly: false,
    sourceUrl: '',
    imageUrl: '',

    // Recurrence fields
    isRecurring: false,
    recurrenceDays: [] as number[],
    recurrenceEndDate: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.submitterEmail)) {
        setError('Please enter a valid email address')
        setSaving(false)
        return
      }

      // Validate recurring event fields
      if (formData.isRecurring) {
        if (formData.recurrenceDays.length === 0) {
          setError('Please select at least one day for recurring events')
          setSaving(false)
          return
        }
      }

      // Calculate start date
      let startDateTime: string

      if (formData.isRecurring) {
        // For recurring events, calculate the next occurrence of the first selected day
        const now = new Date()
        const currentDay = now.getDay()
        const firstRecurringDay = Math.min(...formData.recurrenceDays)

        // Calculate days until next occurrence
        let daysUntilNext = firstRecurringDay - currentDay

        // If the day is today or already passed this week, go to next week
        if (daysUntilNext < 0) {
          daysUntilNext += 7
        } else if (daysUntilNext === 0) {
          // If it's today, check if the time has passed
          const [hours, minutes] = (formData.startTime || '00:00').split(':').map(Number)
          if (now.getHours() > hours || (now.getHours() === hours && now.getMinutes() >= minutes)) {
            daysUntilNext = 7 // Next week same day
          }
        }

        // Create date for next occurrence
        const nextOccurrence = new Date(now)
        nextOccurrence.setDate(now.getDate() + daysUntilNext)
        nextOccurrence.setHours(0, 0, 0, 0) // Reset to start of day

        // Format date as YYYY-MM-DD in local timezone
        const year = nextOccurrence.getFullYear()
        const month = String(nextOccurrence.getMonth() + 1).padStart(2, '0')
        const day = String(nextOccurrence.getDate()).padStart(2, '0')
        const dateStr = `${year}-${month}-${day}`

        startDateTime = formData.startTime
          ? `${dateStr}T${formData.startTime}`
          : `${dateStr}T00:00`

        // Validate recurrence end date is after calculated start date
        if (formData.recurrenceEndDate) {
          const endDate = new Date(formData.recurrenceEndDate)
          const calcStartDate = new Date(startDateTime)
          if (endDate <= calcStartDate) {
            setError('Recurrence end date must be after the calculated start date')
            setSaving(false)
            return
          }
        }
      } else {
        // For one-time events, use the provided date
        startDateTime = formData.startTime
          ? `${formData.startDate}T${formData.startTime}`
          : `${formData.startDate}T00:00`
      }

      let endDateTime = null
      if (formData.endDate) {
        endDateTime = formData.endTime
          ? `${formData.endDate}T${formData.endTime}`
          : `${formData.endDate}T23:59`
      }

      const response = await fetch('/api/submit-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          startDate: startDateTime,
          endDate: formData.isRecurring ? null : endDateTime,
          price: formData.isFree ? null : formData.price || null,
          recurrenceEndDate: formData.recurrenceEndDate || null,
        }),
      })

      if (response.ok) {
        setSuccess(true)
        window.scrollTo(0, 0)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to submit event')
      }
    } catch {
      setError('Failed to submit event. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // Success state - show confirmation
  if (success) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-12">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-stone-900 mb-2">Event Submitted!</h1>
            <p className="text-stone-600 mb-6">
              Thank you for submitting your event. Our team will review it and it should appear on the site within 24-48 hours.
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/"
                className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
              >
                View Events
              </Link>
              <button
                onClick={() => {
                  setSuccess(false)
                  setFormData({
                    title: '',
                    startDate: '',
                    startTime: '',
                    venue: '',
                    submitterEmail: '',
                    description: '',
                    endDate: '',
                    endTime: '',
                    address: '',
                    city: 'Nyack',
                    category: 'OTHER' as Category,
                    price: '',
                    isFree: false,
                    isFamilyFriendly: false,
                    sourceUrl: '',
                    imageUrl: '',
                    isRecurring: false,
                    recurrenceDays: [],
                    recurrenceEndDate: '',
                  })
                }}
                className="px-6 py-2 bg-stone-100 text-stone-700 rounded-lg font-medium hover:bg-stone-200 transition-colors"
              >
                Submit Another Event
              </button>
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  // Form state - render form
  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-stone-900 mb-2">Submit an Event</h1>
          <p className="text-stone-600">
            Know about an upcoming event in Nyack? Share it with the community!
            We&apos;ll review your submission and add it to the calendar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Required Fields Section */}
          <div className="border-b border-stone-200 pb-4">
            <h2 className="font-semibold text-stone-900 mb-4">Required Information</h2>

            {/* Title */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Event Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="e.g., Live Jazz at The Turning Point"
                className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Only show Event Date for one-time events */}
              {!formData.isRecurring && (
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Event Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => updateField('startDate', e.target.value)}
                    className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              )}
              <div className={formData.isRecurring ? 'col-span-2' : ''}>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Start Time *
                </label>
                <input
                  type="time"
                  required
                  value={formData.startTime}
                  onChange={(e) => updateField('startTime', e.target.value)}
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            {/* Recurring Event Section */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="isRecurring"
                  checked={formData.isRecurring}
                  onChange={(e) => {
                    updateField('isRecurring', e.target.checked)
                    if (!e.target.checked) {
                      updateField('recurrenceDays', [])
                      updateField('recurrenceEndDate', '')
                    }
                  }}
                  className="rounded border-stone-300 text-purple-500 focus:ring-purple-500"
                />
                <label htmlFor="isRecurring" className="text-sm font-medium text-stone-700">
                  This is a recurring event
                </label>
              </div>

              {formData.isRecurring && (
                <div className="border-l-4 border-purple-500 pl-4 py-3 bg-purple-50 rounded-r-lg space-y-4">
                  <p className="text-sm text-purple-700 mb-3">
                    For events that happen weekly (e.g., Trivia every Tuesday). Events will be created starting from the next occurrence of the selected day(s).
                  </p>

                  {/* Day Selector */}
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">
                      Repeat on *
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                        <label
                          key={day}
                          className={`flex items-center justify-center px-3 py-2 rounded-lg border-2 cursor-pointer transition-colors ${
                            formData.recurrenceDays.includes(idx)
                              ? 'bg-purple-500 border-purple-500 text-white'
                              : 'bg-white border-stone-300 text-stone-700 hover:border-purple-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={formData.recurrenceDays.includes(idx)}
                            onChange={(e) => {
                              const days = e.target.checked
                                ? [...formData.recurrenceDays, idx]
                                : formData.recurrenceDays.filter(d => d !== idx)
                              updateField('recurrenceDays', days.sort())
                            }}
                            className="sr-only"
                          />
                          <span className="text-sm font-medium">{day}</span>
                        </label>
                      ))}
                    </div>
                    {formData.isRecurring && formData.recurrenceDays.length === 0 && (
                      <p className="text-xs text-red-600 mt-1">
                        Please select at least one day
                      </p>
                    )}
                  </div>

                  {/* Recurrence End Date */}
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      Ends on (optional)
                    </label>
                    <input
                      type="date"
                      value={formData.recurrenceEndDate}
                      onChange={(e) => updateField('recurrenceEndDate', e.target.value)}
                      className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <p className="text-xs text-stone-500 mt-1">
                      Leave blank if this event continues indefinitely
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Venue */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Venue *
              </label>
              <input
                type="text"
                required
                value={formData.venue}
                onChange={(e) => updateField('venue', e.target.value)}
                placeholder="e.g., The Turning Point"
                className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Your Email *
              </label>
              <input
                type="email"
                required
                value={formData.submitterEmail}
                onChange={(e) => updateField('submitterEmail', e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <p className="text-xs text-stone-500 mt-1">
                We&apos;ll only use this to contact you about your submission if needed
              </p>
            </div>
          </div>

          {/* Optional Fields Section */}
          <div>
            <h2 className="font-semibold text-stone-900 mb-4">Additional Details (Optional)</h2>

            {/* Description */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Description
              </label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Tell us more about this event..."
                className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* End Date and Time - only show if not recurring */}
            {!formData.isRecurring && (
              <div className="grid grid-cols-2 gap-4 mb-4">
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
            )}

            {/* Address & City */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="123 Main Street"
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

            {/* Category */}
            <div className="mb-4">
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

            {/* Price */}
            <div className="mb-4">
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
                  placeholder="e.g., $20, $15-$30, Free"
                  value={formData.price}
                  onChange={(e) => updateField('price', e.target.value)}
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              )}
            </div>

            {/* Family Friendly */}
            <div className="flex items-center gap-2 mb-4">
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

            {/* Event URL */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Event Website or More Info
              </label>
              <input
                type="url"
                value={formData.sourceUrl}
                onChange={(e) => updateField('sourceUrl', e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4 pt-4 border-t border-stone-200">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Submitting...' : 'Submit Event for Review'}
            </button>
            <Link
              href="/"
              className="px-6 py-3 bg-stone-100 text-stone-700 rounded-lg font-medium hover:bg-stone-200 transition-colors flex items-center"
            >
              Cancel
            </Link>
          </div>
        </form>
      </main>

      <BottomNav />
    </div>
  )
}
