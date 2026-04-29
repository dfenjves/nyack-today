'use client'

import { useState, useEffect } from 'react'

interface MarqueeEvent {
  id: string
  title: string
  venue: string
  category: string
  startDate: string
}

interface GenerateResult {
  id: string
  title: string
  imageUrl: string | null
  error?: string
}

export default function GenerateImagesPage() {
  const [events, setEvents] = useState<MarqueeEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [results, setResults] = useState<GenerateResult[]>([])
  const [error, setError] = useState('')

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/generate-event-images')
      if (res.ok) {
        const data = await res.json()
        setEvents(data.events)
      }
    } catch {
      setError('Failed to fetch events')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEvents() }, [])

  const generate = async () => {
    setGenerating(true)
    setError('')
    setResults([])
    try {
      const adminPassword = sessionStorage.getItem('admin_password') || ''
      const res = await fetch('/api/admin/generate-event-images', {
        method: 'POST',
        headers: { 'x-admin-password': adminPassword },
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Generation failed')
        return
      }
      const data = await res.json()
      setResults(data.generated)
      await fetchEvents()
    } catch {
      setError('Failed to generate images')
    } finally {
      setGenerating(false)
    }
  }

  const estimatedCost = (events.length * 0.04).toFixed(2)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Generate Event Images</h1>
        <p className="text-stone-500 mt-1">
          Use DALL-E 3 to generate images for marquee events that don't have one yet. Images are persisted to Vercel Blob.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            {loading ? (
              <p className="text-stone-500">Loading…</p>
            ) : (
              <>
                <p className="font-medium text-stone-900">
                  {events.length} marquee event{events.length !== 1 ? 's' : ''} without images
                </p>
                {events.length > 0 && (
                  <p className="text-sm text-stone-400 mt-0.5">
                    ~${estimatedCost} estimated cost (DALL-E 3 standard, $0.04/image)
                  </p>
                )}
              </>
            )}
          </div>
          <button
            onClick={generate}
            disabled={generating || loading || events.length === 0}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? 'Generating…' : 'Generate All'}
          </button>
        </div>

        {generating && (
          <p className="text-sm text-stone-500 italic">
            This may take a minute — generating {events.length} image{events.length !== 1 ? 's' : ''} sequentially…
          </p>
        )}

        {!generating && events.length > 0 && results.length === 0 && (
          <ul className="divide-y divide-stone-100 mt-2">
            {events.map((event) => (
              <li key={event.id} className="py-2 text-sm text-stone-700">
                <span className="font-medium">{event.title}</span>
                <span className="text-stone-400 ml-2">· {event.venue}</span>
              </li>
            ))}
          </ul>
        )}

        {!loading && events.length === 0 && results.length === 0 && (
          <p className="text-sm text-stone-500">All marquee events already have images.</p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h2 className="font-semibold text-stone-900 mb-4">
            Results — {results.filter((r) => r.imageUrl).length}/{results.length} generated successfully
          </h2>
          <div className="flex flex-col gap-4">
            {results.map((result) => (
              <div key={result.id} className="flex gap-4 items-start">
                {result.imageUrl ? (
                  <img
                    src={result.imageUrl}
                    alt={result.title}
                    className="w-48 h-28 object-cover rounded-lg flex-shrink-0"
                  />
                ) : (
                  <div className="w-48 h-28 bg-red-50 border border-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-red-400">Failed</span>
                  </div>
                )}
                <div className="pt-1">
                  <p className="font-medium text-stone-900 text-sm">{result.title}</p>
                  {result.error && (
                    <p className="text-xs text-red-500 mt-1">{result.error}</p>
                  )}
                  {result.imageUrl && (
                    <a
                      href={result.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-orange-500 hover:underline mt-1 block"
                    >
                      View full image →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
