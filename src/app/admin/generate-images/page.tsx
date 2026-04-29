'use client'

import { useState, useEffect } from 'react'
import { formatDate } from '@/lib/utils/dates'

interface MarqueeEvent {
  id: string
  title: string
  venue: string
  category: string
  startDate: string
  imageUrl: string | null
  suggestedPrompt: string
}

interface EventState {
  prompt: string
  imageUrl: string | null
  generating: boolean
  error: string
}

export default function GenerateImagesPage() {
  const [events, setEvents] = useState<MarqueeEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [states, setStates] = useState<Record<string, EventState>>({})

  useEffect(() => {
    fetch('/api/admin/generate-event-images')
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events ?? [])
        const initial: Record<string, EventState> = {}
        for (const e of data.events ?? []) {
          initial[e.id] = {
            prompt: e.suggestedPrompt,
            imageUrl: e.imageUrl,
            generating: false,
            error: '',
          }
        }
        setStates(initial)
      })
      .finally(() => setLoading(false))
  }, [])

  const update = (id: string, patch: Partial<EventState>) =>
    setStates((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))

  const generate = async (eventId: string) => {
    const state = states[eventId]
    if (!state || state.generating) return

    update(eventId, { generating: true, error: '' })

    try {
      const adminPassword = sessionStorage.getItem('admin_password') || ''
      const res = await fetch('/api/admin/generate-event-images', {
        method: 'POST',
        headers: {
          'x-admin-password': adminPassword,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ eventId, prompt: state.prompt }),
      })
      const data = await res.json()
      if (!res.ok) {
        update(eventId, { error: data.error || 'Generation failed', generating: false })
        return
      }
      update(eventId, { imageUrl: data.imageUrl, generating: false })
    } catch {
      update(eventId, { error: 'Failed to connect to server', generating: false })
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-stone-900 mb-6">Generate Event Images</h1>
        <p className="text-stone-500">Loading…</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Generate Event Images</h1>
        <p className="text-stone-500 mt-1">
          Edit the prompt for each event, then generate. Images are saved immediately and will appear on the site.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {events.map((event) => {
          const state = states[event.id]
          if (!state) return null
          const hasImage = !!state.imageUrl

          return (
            <div key={event.id} className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              {/* Image strip */}
              {state.imageUrl ? (
                <img
                  src={state.imageUrl}
                  alt={event.title}
                  className="w-full h-48 object-cover"
                />
              ) : (
                <div className="w-full h-48 bg-stone-100 flex items-center justify-center">
                  <span className="text-stone-400 text-sm">No image yet</span>
                </div>
              )}

              <div className="p-5">
                {/* Event info */}
                <h2 className="font-semibold text-stone-900">{event.title}</h2>
                <p className="text-sm text-stone-500 mt-0.5">
                  {event.venue} · {formatDate(new Date(event.startDate))}
                </p>

                {/* Prompt editor */}
                <label className="block mt-4 mb-1 text-xs font-medium text-stone-500 uppercase tracking-wide">
                  Prompt
                </label>
                <textarea
                  value={state.prompt}
                  onChange={(e) => update(event.id, { prompt: e.target.value })}
                  rows={4}
                  disabled={state.generating}
                  className="w-full text-sm text-stone-800 border border-stone-200 rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-50"
                />

                {/* Actions */}
                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={() => generate(event.id)}
                    disabled={state.generating || !state.prompt.trim()}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {state.generating
                      ? 'Generating…'
                      : hasImage
                      ? 'Regenerate'
                      : 'Generate Image'}
                  </button>

                  {!state.generating && state.prompt !== event.suggestedPrompt && (
                    <button
                      onClick={() => update(event.id, { prompt: event.suggestedPrompt })}
                      className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
                    >
                      Reset prompt
                    </button>
                  )}

                  {state.imageUrl && (
                    <a
                      href={state.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-orange-500 hover:underline ml-auto"
                    >
                      View full size →
                    </a>
                  )}
                </div>

                {state.error && (
                  <p className="mt-2 text-sm text-red-500">{state.error}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
