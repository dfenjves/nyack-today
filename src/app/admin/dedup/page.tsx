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
  groupKey: string
  winner: EventSummary
  members: EventSummary[]
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

function EventCard({
  event,
  isWinner,
  groupKey,
  onSelect,
}: {
  event: EventSummary
  isWinner: boolean
  groupKey: string
  onSelect: (groupKey: string, eventId: string) => void
}) {
  const borderClass = isWinner ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
  const badgeClass = isWinner ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'
  const inputId = `winner-${groupKey}-${event.id}`

  return (
    <label htmlFor={inputId} className={`flex gap-3 items-start border ${borderClass} rounded-lg p-4 mb-2 cursor-pointer`}>
      <input
        id={inputId}
        type="radio"
        name={`winner-${groupKey}`}
        checked={isWinner}
        onChange={() => onSelect(groupKey, event.id)}
        className="mt-1"
      />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-semibold ${badgeClass} px-2 py-0.5 rounded`}>
            {isWinner ? 'KEEP' : 'DELETE'}
          </span>
          <a
            href={event.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
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
    </label>
  )
}

export default function AdminDedupPage() {
  const [scanning, setScanning] = useState(false)
  const [merging, setMerging] = useState(false)
  const [result, setResult] = useState<DedupResult | null>(null)
  const [mergeResult, setMergeResult] = useState<DedupResult | null>(null)
  const [error, setError] = useState('')
  const [selectedWinners, setSelectedWinners] = useState<Record<string, string>>({})

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
      setSelectedWinners(
        Object.fromEntries((data as DedupResult).groups.map((g: GroupResult) => [g.groupKey, g.winner.id]))
      )
    } catch {
      setError('Scan failed')
    } finally {
      setScanning(false)
    }
  }

  const selectWinner = (groupKey: string, eventId: string) => {
    setSelectedWinners(prev => ({ ...prev, [groupKey]: eventId }))
  }

  const mergeAll = async () => {
    const loserCount = result!.groups.reduce((n, g) => n + g.members.length - 1, 0)
    if (!confirm(`Merge ${result!.groupsFound} duplicate group(s) and delete ${loserCount} event(s)?`)) return
    setMerging(true)
    setError('')
    try {
      const res = await fetch('/api/admin/dedup?dryRun=false', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winnerOverrides: selectedWinners }),
      })
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

  const loserCount = result?.groups.reduce((n, g) => n + g.members.length - 1, 0) ?? 0

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

          {result.groups.map((group, i) => {
            const winnerId = selectedWinners[group.groupKey] ?? group.winner.id
            return (
              <div key={group.groupKey} className="bg-white border border-stone-200 rounded-xl p-5 mb-4">
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
                <p className="text-xs text-stone-400 mb-2">Select which event to keep:</p>
                {group.members.map(member => (
                  <EventCard
                    key={member.id}
                    event={member}
                    isWinner={member.id === winnerId}
                    groupKey={group.groupKey}
                    onSelect={selectWinner}
                  />
                ))}
              </div>
            )
          })}
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
