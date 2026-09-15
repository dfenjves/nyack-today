'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import CoverageGrid from '@/components/admin/CoverageGrid'
import SourcesTable from '@/components/admin/SourcesTable'
import { formatRelative, PulseResponse } from '@/lib/utils/pulse'

const VERCEL_ANALYTICS_URL = process.env.NEXT_PUBLIC_VERCEL_ANALYTICS_URL

export default function AdminPulsePage() {
  const [pulse, setPulse] = useState<PulseResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/pulse', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(response.status === 401 ? 'Unauthorized — log in again' : `Request failed (${response.status})`)
      }
      setPulse(await response.json())
      setError('')
    } catch (fetchError) {
      console.error('Failed to fetch pulse:', fetchError)
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load pulse')
    } finally {
      setNow(Date.now())
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Keep "Generated N min ago" honest while the page sits open.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [])

  const refresh = () => {
    setRefreshing(true)
    load()
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
        <p className="text-stone-500 mt-4">Loading pulse...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Pulse</h1>
          <p className="text-sm text-stone-500">
            {pulse ? `Generated ${formatRelative(pulse.generatedAt, now)}` : 'No data'}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {pulse && (
        <>
          {/* Audience */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <PulseTile
              label="Weekly Active Locals"
              value="—"
              muted
              caption="Not instrumented yet, see plan.md Phase 0 #1"
              externalHref={VERCEL_ANALYTICS_URL}
            />
            <PulseTile
              label="Email subscribers"
              value={pulse.audience.subscribersActive}
              delta={pulse.audience.subscribersLast7Days}
              href="/admin/subscribers"
            />
            <PulseTile
              label="iOS devices"
              value={pulse.audience.devicesActive}
              delta={pulse.audience.devicesLast7Days}
            />
            <PulseTile
              label="Submissions this week"
              value={pulse.audience.submissionsLast7Days}
              caption={`${pulse.audience.submissionsPending} pending review`}
              href="/admin/submissions"
            />
          </div>

          {/* Coverage */}
          <section className="mb-8">
            <h2 className="font-semibold text-stone-900 mb-3">Coverage, next 14 days</h2>
            <CoverageGrid coverage={pulse.coverage} />
          </section>

          {/* Sources */}
          <section>
            <h2 className="font-semibold text-stone-900 mb-3">Sources</h2>
            <SourcesTable sources={pulse.sources} now={now} />
          </section>
        </>
      )}
    </div>
  )
}

function PulseTile({
  label,
  value,
  delta,
  caption,
  muted = false,
  href,
  externalHref,
}: {
  label: string
  value: number | string
  delta?: number
  caption?: string
  muted?: boolean
  href?: string
  externalHref?: string
}) {
  const content = (
    <div className="bg-white rounded-xl border border-stone-200 p-4 h-full">
      <p className="text-sm text-stone-500">{label}</p>
      <p className={`text-3xl font-bold ${muted ? 'text-stone-400' : 'text-orange-600'}`}>{value}</p>
      {delta !== undefined && (
        <p className={`text-xs mt-1 ${delta > 0 ? 'text-green-700' : 'text-stone-500'}`}>+{delta} this week</p>
      )}
      {caption && <p className="text-xs text-stone-500 mt-1">{caption}</p>}
    </div>
  )

  const linkClass = 'block hover:shadow-md transition-shadow rounded-xl'
  if (externalHref) {
    return (
      <a href={externalHref} target="_blank" rel="noopener noreferrer" className={linkClass}>
        {content}
      </a>
    )
  }
  if (href) {
    return (
      <Link href={href} className={linkClass}>
        {content}
      </Link>
    )
  }
  return content
}
