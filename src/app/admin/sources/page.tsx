'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { formatRelative } from '@/lib/utils/pulse'

// Kept as plain string literals rather than importing the Prisma enums, so this
// client bundle doesn't pull in @prisma/client.
const FETCH_MODES = ['CHEERIO', 'PUPPETEER', 'ICAL', 'RSS', 'JSONLD'] as const
type FetchMode = (typeof FETCH_MODES)[number]

const FETCH_MODE_HELP: Record<FetchMode, string> = {
  CHEERIO: 'Static HTML. Start here — fastest and cheapest. Works if the events are in the page source.',
  PUPPETEER: 'Renders JavaScript first. Use when the page looks empty in CHEERIO (calendar widgets, React sites).',
  ICAL: 'An .ics calendar feed. No AI call, most accurate times. Look for "Add to calendar" / "Subscribe" links.',
  RSS: 'An RSS or Atom feed. Each item is read by AI. Look for /feed, /rss, or a feed icon.',
  JSONLD: 'schema.org Event data embedded in the page. No AI call. Common on WordPress event plugins.',
}

const CATEGORIES = [
  'MUSIC',
  'COMEDY',
  'MOVIES',
  'THEATER',
  'FAMILY_KIDS',
  'FOOD_DRINK',
  'SPORTS_RECREATION',
  'COMMUNITY_GOVERNMENT',
  'ART_GALLERIES',
  'CLASSES_WORKSHOPS',
  'OTHER',
] as const

/** Clean runs at which the Sources page nudges Danny to consider auto-publish. */
const AUTO_PUBLISH_THRESHOLD = 3

interface Source {
  id: string
  name: string
  slug: string
  urls: string[]
  fetchMode: FetchMode
  defaultVenue: string | null
  defaultAddress: string | null
  defaultCity: string
  isNyackProper: boolean
  defaultCategory: string | null
  familyFriendlyHint: boolean | null
  autoPublish: boolean
  cleanRuns: number
  enabled: boolean
  notes: string | null
  lastRunAt: string | null
  lastStatus: string | null
  lastError: string | null
  pendingSubmissions: number
}

interface TestEvent {
  title: string
  startDate: string
  endDate: string | null
  venue: string
  city: string
  category: string
  price: string | null
  isFree: boolean
  isFamilyFriendly: boolean
  sourceUrl: string
  imageUrl: string | null
}

interface TestResult {
  sourceName: string
  fetchMode: string
  elapsedMs: number
  eventCount: number
  events: TestEvent[]
  warnings: string[]
  pages: {
    url: string
    fetchMode: string
    textLength: number
    estimatedTokens: number
    elapsedMs: number
    eventsFound: number
    truncated: boolean
  }[]
}

interface FormState {
  id: string | null
  name: string
  urls: string
  fetchMode: FetchMode
  defaultVenue: string
  defaultAddress: string
  defaultCity: string
  isNyackProper: boolean
  defaultCategory: string
  familyFriendlyHint: 'auto' | 'yes' | 'no'
  notes: string
}

const EMPTY_FORM: FormState = {
  id: null,
  name: '',
  urls: '',
  fetchMode: 'CHEERIO',
  defaultVenue: '',
  defaultAddress: '',
  defaultCity: 'Nyack',
  isNyackProper: true,
  defaultCategory: '',
  familyFriendlyHint: 'auto',
  notes: '',
}

const easternDateTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function formatEastern(iso: string): string {
  return `${easternDateTime.format(new Date(iso))} ET`
}

function formStateToPayload(form: FormState) {
  return {
    name: form.name,
    urls: form.urls,
    fetchMode: form.fetchMode,
    defaultVenue: form.defaultVenue,
    defaultAddress: form.defaultAddress,
    defaultCity: form.defaultCity,
    isNyackProper: form.isNyackProper,
    defaultCategory: form.defaultCategory || null,
    familyFriendlyHint:
      form.familyFriendlyHint === 'auto' ? null : form.familyFriendlyHint === 'yes',
    notes: form.notes,
  }
}

export default function AdminSourcesPage() {
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())

  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [hasTested, setHasTested] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [busySourceId, setBusySourceId] = useState<string | null>(null)

  const fetchSources = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/sources')
      if (!response.ok) {
        setError((await response.json()).error || 'Failed to load sources')
        return
      }
      const data = await response.json()
      setSources(data.sources)
      setNow(Date.now())
      setError('')
    } catch {
      setError('Failed to load sources')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSources()
  }, [fetchSources])

  const openNewForm = () => {
    setForm({ ...EMPTY_FORM })
    setTestResult(null)
    setHasTested(false)
  }

  const openEditForm = (source: Source) => {
    setForm({
      id: source.id,
      name: source.name,
      urls: source.urls.join('\n'),
      fetchMode: source.fetchMode,
      defaultVenue: source.defaultVenue ?? '',
      defaultAddress: source.defaultAddress ?? '',
      defaultCity: source.defaultCity,
      isNyackProper: source.isNyackProper,
      defaultCategory: source.defaultCategory ?? '',
      familyFriendlyHint:
        source.familyFriendlyHint === null ? 'auto' : source.familyFriendlyHint ? 'yes' : 'no',
      notes: source.notes ?? '',
    })
    setTestResult(null)
    // An existing source has already proved itself; don't force a re-test to save.
    setHasTested(true)
  }

  const runTest = async () => {
    if (!form) return
    setTesting(true)
    setError('')
    try {
      const response = await fetch('/api/admin/sources/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formStateToPayload(form)),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Test failed')
        setTestResult(null)
      } else {
        setTestResult(data)
      }
      // Save unlocks after any test, successful or not — a source that returns
      // nothing today may still be worth keeping and retrying.
      setHasTested(true)
    } catch {
      setError('Test failed')
      setHasTested(true)
    } finally {
      setTesting(false)
    }
  }

  const saveSource = async () => {
    if (!form) return
    setSaving(true)
    setError('')
    try {
      const isEdit = Boolean(form.id)
      const response = await fetch(
        isEdit ? `/api/admin/sources/${form.id}` : '/api/admin/sources',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formStateToPayload(form)),
        }
      )
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Failed to save source')
        return
      }
      setForm(null)
      setTestResult(null)
      await fetchSources()
    } catch {
      setError('Failed to save source')
    } finally {
      setSaving(false)
    }
  }

  const patchSource = async (source: Source, changes: Record<string, unknown>) => {
    setBusySourceId(source.id)
    setError('')
    try {
      const response = await fetch(`/api/admin/sources/${source.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
      if (!response.ok) {
        setError((await response.json()).error || 'Failed to update source')
        return
      }
      await fetchSources()
    } catch {
      setError('Failed to update source')
    } finally {
      setBusySourceId(null)
    }
  }

  const testSaved = async (source: Source) => {
    setBusySourceId(source.id)
    setError('')
    setTestResult(null)
    try {
      const response = await fetch(`/api/admin/sources/${source.id}/test`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) setError(data.error || 'Test failed')
      else setTestResult(data)
    } catch {
      setError('Test failed')
    } finally {
      setBusySourceId(null)
    }
  }

  const runSource = async (source: Source) => {
    setBusySourceId(source.id)
    setError('')
    try {
      const response = await fetch(`/api/admin/sources/${source.id}/run`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) setError(data.error || 'Run failed')
      await fetchSources()
    } catch {
      setError('Run failed')
    } finally {
      setBusySourceId(null)
    }
  }

  const deleteSource = async (source: Source) => {
    if (!confirm(`Delete the "${source.name}" source? Its existing events and submissions are kept.`)) {
      return
    }
    setBusySourceId(source.id)
    try {
      const response = await fetch(`/api/admin/sources/${source.id}`, { method: 'DELETE' })
      if (!response.ok) setError((await response.json()).error || 'Failed to delete source')
      await fetchSources()
    } catch {
      setError('Failed to delete source')
    } finally {
      setBusySourceId(null)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto" />
        <p className="text-stone-500 mt-4">Loading sources...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-stone-900">Sources</h1>
        <button
          onClick={openNewForm}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
        >
          + Add source
        </button>
      </div>
      <p className="text-sm text-stone-500 mb-6">
        Config-driven scrapers. Paste a URL, pick how to fetch it, hit Test, and save — no deploy
        needed. New sources send their events to{' '}
        <Link href="/admin/submissions" className="text-orange-600 hover:underline">
          Submissions
        </Link>{' '}
        for review until you switch them to auto-publish.
      </p>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {form && (
        <SourceForm
          form={form}
          setForm={setForm}
          onCancel={() => {
            setForm(null)
            setTestResult(null)
          }}
          onTest={runTest}
          onSave={saveSource}
          testing={testing}
          saving={saving}
          canSave={hasTested}
        />
      )}

      {testResult && <TestResultPanel result={testResult} onDismiss={() => setTestResult(null)} />}

      {sources.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-stone-200">
          <p className="text-stone-500">No sources yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">Source</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">Mode</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">Publishing</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">Last run</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-stone-600">Pending</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-stone-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {sources.map((source) => (
                  <tr key={source.id} className={source.enabled ? '' : 'bg-stone-50/60'}>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-stone-900">{source.name}</div>
                      <div className="text-xs text-stone-500 break-all max-w-xs">
                        {source.urls.join(' · ')}
                      </div>
                      {source.notes && (
                        <div className="text-xs text-stone-400 mt-1 max-w-xs">{source.notes}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      <span className="px-2 py-1 text-xs rounded-full bg-stone-100 text-stone-700">
                        {source.fetchMode}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          source.autoPublish
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {source.autoPublish ? 'Auto' : 'Review'}
                      </span>
                      {!source.autoPublish && source.cleanRuns >= AUTO_PUBLISH_THRESHOLD && (
                        <div className="text-xs text-green-700 mt-1">
                          {source.cleanRuns} clean runs, ready to auto-publish
                        </div>
                      )}
                      {!source.autoPublish && source.cleanRuns > 0 && source.cleanRuns < AUTO_PUBLISH_THRESHOLD && (
                        <div className="text-xs text-stone-400 mt-1">
                          {source.cleanRuns} of {AUTO_PUBLISH_THRESHOLD} clean runs
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-stone-600 whitespace-nowrap">
                      {source.lastRunAt ? (
                        <>
                          <span
                            className={
                              source.lastStatus === 'success'
                                ? 'text-green-700'
                                : source.lastStatus === 'partial'
                                  ? 'text-yellow-700'
                                  : 'text-red-700'
                            }
                          >
                            {source.lastStatus}
                          </span>
                          {' · '}
                          {formatRelative(source.lastRunAt, now)}
                          {source.lastError && (
                            <div
                              className="text-xs text-stone-400 max-w-xs truncate"
                              title={source.lastError}
                            >
                              {source.lastError}
                            </div>
                          )}
                        </>
                      ) : (
                        'never run'
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-right text-sm tabular-nums">
                      {source.pendingSubmissions > 0 ? (
                        <Link
                          href="/admin/submissions"
                          className="text-orange-600 hover:underline font-medium"
                        >
                          {source.pendingSubmissions}
                        </Link>
                      ) : (
                        <span className="text-stone-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                      <div className="flex flex-wrap gap-2 justify-end">
                        <ActionButton
                          disabled={busySourceId === source.id || !source.enabled}
                          onClick={() => runSource(source)}
                        >
                          Run
                        </ActionButton>
                        <ActionButton
                          disabled={busySourceId === source.id}
                          onClick={() => testSaved(source)}
                        >
                          Test
                        </ActionButton>
                        <ActionButton
                          disabled={busySourceId === source.id}
                          onClick={() => openEditForm(source)}
                        >
                          Edit
                        </ActionButton>
                        <ActionButton
                          disabled={busySourceId === source.id}
                          onClick={() => patchSource(source, { enabled: !source.enabled })}
                        >
                          {source.enabled ? 'Disable' : 'Enable'}
                        </ActionButton>
                        <ActionButton
                          disabled={busySourceId === source.id}
                          onClick={() => patchSource(source, { autoPublish: !source.autoPublish })}
                        >
                          {source.autoPublish ? '→ Review' : '→ Auto'}
                        </ActionButton>
                        <ActionButton
                          disabled={busySourceId === source.id}
                          onClick={() => deleteSource(source)}
                          danger
                        >
                          Delete
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function ActionButton({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-2 py-1 text-xs rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        danger
          ? 'border-red-200 text-red-600 hover:bg-red-50'
          : 'border-stone-200 text-stone-700 hover:bg-stone-50'
      }`}
    >
      {children}
    </button>
  )
}

function SourceForm({
  form,
  setForm,
  onCancel,
  onTest,
  onSave,
  testing,
  saving,
  canSave,
}: {
  form: FormState
  setForm: (form: FormState) => void
  onCancel: () => void
  onTest: () => void
  onSave: () => void
  testing: boolean
  saving: boolean
  canSave: boolean
}) {
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm({ ...form, [key]: value })

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 mb-6">
      <h2 className="font-semibold text-stone-900 mb-4">
        {form.id ? `Edit ${form.name}` : 'Add source'}
      </h2>

      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Name" hint="Becomes the source name on events and in Pulse">
          <input
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Nyack Center"
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Default venue" hint="Used when the page doesn't name one">
          <input
            type="text"
            value={form.defaultVenue}
            onChange={(e) => update('defaultVenue', e.target.value)}
            placeholder="Nyack Center"
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="URLs" hint="One per line, up to 3 are fetched per run" className="md:col-span-2">
          <textarea
            value={form.urls}
            onChange={(e) => update('urls', e.target.value)}
            rows={3}
            placeholder="https://nyackcenter.org/events"
            className={`${INPUT_CLASS} font-mono text-sm`}
          />
        </Field>

        <Field label="Fetch mode" hint={FETCH_MODE_HELP[form.fetchMode]} className="md:col-span-2">
          <select
            value={form.fetchMode}
            onChange={(e) => update('fetchMode', e.target.value as FetchMode)}
            className={INPUT_CLASS}
          >
            {FETCH_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Default address">
          <input
            type="text"
            value={form.defaultAddress}
            onChange={(e) => update('defaultAddress', e.target.value)}
            placeholder="58 Depew Ave"
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Default city">
          <input
            type="text"
            value={form.defaultCity}
            onChange={(e) => update('defaultCity', e.target.value)}
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Default category" hint="A hint for the AI — it may still override">
          <select
            value={form.defaultCategory}
            onChange={(e) => update('defaultCategory', e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">Auto (guess per event)</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Family friendly">
          <select
            value={form.familyFriendlyHint}
            onChange={(e) => update('familyFriendlyHint', e.target.value as FormState['familyFriendlyHint'])}
            className={INPUT_CLASS}
          >
            <option value="auto">Auto</option>
            <option value="yes">Yes — always</option>
            <option value="no">No — never</option>
          </select>
        </Field>

        <Field label="Notes" hint="For you, e.g. &quot;calendar is at the bottom of the page&quot;" className="md:col-span-2">
          <input
            type="text"
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            className={INPUT_CLASS}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-stone-700 md:col-span-2">
          <input
            type="checkbox"
            checked={form.isNyackProper}
            onChange={(e) => update('isNyackProper', e.target.checked)}
            className="rounded border-stone-300 text-orange-500 focus:ring-orange-500"
          />
          Nyack proper (uncheck for West Nyack, Piermont, Tarrytown, etc.)
        </label>
      </div>

      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={onTest}
          disabled={testing || !form.name || !form.urls}
          className="px-4 py-2 border border-orange-500 text-orange-600 rounded-lg font-medium hover:bg-orange-50 disabled:opacity-50 transition-colors"
        >
          {testing ? 'Testing...' : 'Test'}
        </button>
        <button
          onClick={onSave}
          disabled={saving || !canSave}
          title={canSave ? undefined : 'Run a test first'}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : form.id ? 'Save changes' : 'Save source'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-stone-500 hover:text-stone-700">
          Cancel
        </button>
        {!canSave && (
          <span className="text-xs text-stone-400">Run a test before saving.</span>
        )}
      </div>
    </div>
  )
}

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-orange-500'

function Field({
  label,
  hint,
  children,
  className = '',
}: {
  label: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-stone-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-stone-500 mt-1">{hint}</p>}
    </div>
  )
}

function TestResultPanel({ result, onDismiss }: { result: TestResult; onDismiss: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 mb-6">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="font-semibold text-stone-900">
            Test: {result.sourceName} — {result.eventCount} event
            {result.eventCount === 1 ? '' : 's'}
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            {result.fetchMode} · {(result.elapsedMs / 1000).toFixed(1)}s · nothing was saved
          </p>
        </div>
        <button onClick={onDismiss} className="text-sm text-stone-400 hover:text-stone-600">
          Dismiss
        </button>
      </div>

      <div className="space-y-1 mb-4">
        {result.pages.map((page) => (
          <p key={page.url} className="text-xs text-stone-500 break-all">
            {page.url} — {page.fetchMode}, {page.textLength.toLocaleString()} chars, ~
            {page.estimatedTokens.toLocaleString()} tokens
            {page.truncated ? ' (truncated)' : ''}, {(page.elapsedMs / 1000).toFixed(1)}s,{' '}
            {page.eventsFound} events
          </p>
        ))}
      </div>

      {result.events.length === 0 ? (
        <p className="text-sm text-stone-500">
          No events came back. Try a different fetch mode, or point at the site&apos;s actual
          calendar page.
        </p>
      ) : (
        <ul className="divide-y divide-stone-100 border-t border-stone-100">
          {result.events.map((event, index) => (
            <li key={`${event.title}-${index}`} className="py-3">
              <div className="font-medium text-stone-900">{event.title}</div>
              <div className="text-sm text-stone-600">
                {formatEastern(event.startDate)} · {event.venue}, {event.city} ·{' '}
                {event.price ?? (event.isFree ? 'Free' : 'no price')} · {event.category}
                {event.isFamilyFriendly ? ' · family' : ''}
              </div>
              <a
                href={event.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-orange-600 hover:underline break-all"
              >
                {event.sourceUrl}
              </a>
            </li>
          ))}
        </ul>
      )}

      {result.warnings.length > 0 && (
        <div className="mt-4 pt-4 border-t border-stone-100">
          <p className="text-xs font-medium text-stone-600 mb-1">Warnings</p>
          <ul className="space-y-1">
            {result.warnings.map((warning, index) => (
              <li key={index} className="text-xs text-amber-700 break-all">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
