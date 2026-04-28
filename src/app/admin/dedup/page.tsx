'use client'

import { useState } from 'react'

interface EventSummary {
  id: string
  title: string
  venue: string
  startDate: string
  sourceName: string
  sourceUrl: string
}

interface GroupResult {
  winner: EventSummary
  losers: EventSummary[]
  similarity: {
    titleSimilarity: number
    venueSimilarity: number
  }
}

interface DedupResult {
  dryRun: boolean
  groupsFound: number
  eventsDeleted: number
  eventsUpdated: number
  groups: GroupResult[]
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  })
}

function EventCard({ event, label, color }: { event: EventSummary; label: string; color: 'green' | 'red' }) {
  const borderClass = color === 'green' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
  const badgeClass = color === 'green' ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'

  return (
    <div className={`border ${borderClass} rounded-lg p-4 mb-2`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs font-semibold ${badgeClass} px-2 py-0.5 rounded`}>
          {label}
        </span>
        <a
          href={event.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-stone-900 hover:text-orange-600 hover:underline"
        >
          {event.title}
        </a>
      </div>
      <p className="text-sm text-stone-600">
        {event.venue} &middot; {formatDate(event.startDate)}
      </p>
      <p className="text-xs text-stone-400 mt-1">Source: {event.sourceName}</p>
    </div>
  )
}

export default function AdminDedupPage() {
  const [scanning, setScanning] = useState(false)
  const [merging, setMerging] = useState(false)
  const [result, setResult] = useState<DedupResult | null>(null)
  const [mergeResult, setMergeResult] = useState<DedupResult | null>(null)
  const [error, setError] = useState('')

  const scan = async () => {
    setScanning(true)
    setError('')
    setResult(null)
    setMergeResult(null)
    try {
      const res = await fetch('/api/admin/dedup?dryRun=true', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Scan failed'); return }
      setResult(data)
    } catch {
      setError('Scan failed')
    } finally {
      setScanning(false)
    }
  }

  const mergeAll = async () => {
    const loserCount = result!.groups.reduce((n, g) => n + g.losers.length, 0)
    if (!confirm(`Merge ${result!.groupsFound} duplicate group(s) and delete ${loserCount} event(s)?`)) return
    setMerging(true)
    setError('')
    try {
      const res = await fetch('/api/admin/dedup?dryRun=false', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Merge failed'); return }
      setMergeResult(data)
      setResult(null)
    } catch {
      setError('Merge failed')
    } finally {
      setMerging(false)
    }
  }

  const loserCount = result?.groups.reduce((n, g) => n + g.losers.length, 0) ?? 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Deduplication</h1>
          <p className="text-sm text-stone-500">Scan upcoming events for duplicates and merge them</p>
        </div>
        <button
          onClick={scan}
          disabled={scanning || merging}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {scanning ? 'Scanning...' : 'Scan for Duplicates'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {mergeResult && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-4 rounded-lg mb-6">
          <p className="font-semibold">Merge complete</p>
          <p className="text-sm">
            {mergeResult.eventsDeleted} event{mergeResult.eventsDeleted !== 1 ? 's' : ''} deleted,{' '}
            {mergeResult.eventsUpdated} winner{mergeResult.eventsUpdated !== 1 ? 's' : ''} updated with merged fields.
          </p>
          <button onClick={scan} className="mt-2 text-sm text-green-700 underline hover:text-green-900">
            Scan again
          </button>
        </div>
      )}

      {result && (
        <div>
          <div className="flex items-center justify-between bg-white border border-stone-200 rounded-xl px-5 py-4 mb-6">
            <div>
              {result.groupsFound === 0 ? (
                <p className="font-semibold text-green-700">No duplicates found</p>
              ) : (
                <>
                  <p className="font-semibold text-stone-900">
                    {result.groupsFound} duplicate group{result.groupsFound !== 1 ? 's' : ''} found
                  </p>
                  <p className="text-sm text-stone-500">
                    {loserCount} event{loserCount !== 1 ? 's' : ''} will be removed
                  </p>
                </>
              )}
            </div>
            {result.groupsFound > 0 && (
              <button
                onClick={mergeAll}
                disabled={merging}
                className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {merging ? 'Merging...' : 'Merge All Duplicates'}
              </button>
            )}
          </div>

          {result.groups.map((group, i) => (
            <div key={group.winner.id} className="bg-white border border-stone-200 rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-medium bg-stone-100 text-stone-600 px-2 py-1 rounded">
                  Group {i + 1}
                </span>
                <span className="text-xs text-stone-500">
                  Title similarity: {(group.similarity.titleSimilarity * 100).toFixed(0)}%
                  {' · '}
                  Venue similarity: {(group.similarity.venueSimilarity * 100).toFixed(0)}%
                </span>
              </div>
              <EventCard event={group.winner} label="KEEP" color="green" />
              {group.losers.map(loser => (
                <EventCard key={loser.id} event={loser} label="DELETE" color="red" />
              ))}
            </div>
          ))}
        </div>
      )}

      {!result && !mergeResult && !scanning && !error && (
        <div className="text-center py-16 bg-white rounded-xl border border-stone-200">
          <p className="text-stone-500 mb-2">Click Scan to check for duplicate events in the database</p>
          <p className="text-sm text-stone-400">Only upcoming, visible, non-recurring events are checked</p>
        </div>
      )}
    </div>
  )
}
