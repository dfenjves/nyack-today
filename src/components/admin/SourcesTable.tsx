import Link from 'next/link'
import { formatRelative, PulseSource, SourceStatus } from '@/lib/utils/pulse'

const STATUS_PILLS: Record<SourceStatus, { label: string; className: string }> = {
  never: { label: 'never run', className: 'bg-red-100 text-red-700' },
  stale: { label: 'stale', className: 'bg-red-100 text-red-700' },
  zero: { label: 'zero found', className: 'bg-amber-100 text-amber-800' },
  ok: { label: 'ok', className: 'bg-green-100 text-green-700' },
}

function runStatusClass(status: string) {
  if (status === 'success') return 'text-green-700'
  if (status === 'partial') return 'text-yellow-700'
  return 'text-red-700'
}

const HEAD_CELL = 'text-left px-4 py-3 text-sm font-medium text-stone-600 whitespace-nowrap'
const CELL = 'px-4 py-3 text-sm text-stone-600 whitespace-nowrap'

export default function SourcesTable({ sources, now }: { sources: PulseSource[]; now: number }) {
  if (sources.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-stone-200">
        <p className="text-stone-500">No sources</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              <th className={HEAD_CELL}>Source</th>
              <th className={HEAD_CELL}>Status</th>
              <th className={HEAD_CELL}>Last success</th>
              <th className={HEAD_CELL}>Last run</th>
              <th className={`${HEAD_CELL} text-right`}>Added 7d</th>
              <th className={`${HEAD_CELL} text-right`}>Upcoming 30d</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {sources.map((source) => {
              const pill = STATUS_PILLS[source.status]
              return (
                <tr key={source.sourceName} className={source.registered ? '' : 'bg-stone-50/60'}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {source.registered ? (
                      <Link
                        href={`/admin/scrapers?source=${encodeURIComponent(source.sourceName)}`}
                        className="font-medium text-stone-900 hover:text-orange-600 hover:underline"
                      >
                        {source.sourceName}
                      </Link>
                    ) : (
                      <span className="font-medium text-stone-500">{source.sourceName}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {source.registered ? (
                      <span className={`px-2 py-1 text-xs rounded-full ${pill.className}`}>{pill.label}</span>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded-full bg-stone-100 text-stone-500">manual</span>
                    )}
                  </td>
                  <td className={CELL} title={source.lastSuccessAt ?? undefined}>
                    {formatRelative(source.lastSuccessAt, now)}
                  </td>
                  <td className={CELL} title={source.lastRunAt ?? undefined}>
                    {source.lastStatus ? (
                      <>
                        <span className={runStatusClass(source.lastStatus)}>{source.lastStatus}</span>
                        {' · '}
                        {source.eventsFoundLastRun} found
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={`${CELL} text-right tabular-nums`}>{source.eventsAddedLast7Days}</td>
                  <td className={`${CELL} text-right tabular-nums`}>{source.upcomingEvents}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
