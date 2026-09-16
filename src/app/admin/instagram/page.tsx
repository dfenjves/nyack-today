'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { formatRelative } from '@/lib/utils/pulse'

interface InstagramHandle {
  id: string
  handle: string
  venueName: string | null
  notes: string | null
  enabled: boolean
  inEnv: boolean
  postsProcessed: number
  eventsExtracted: number
  lastPostAt: string | null
  createdAt: string
}

interface FormState {
  handle: string
  venueName: string
  notes: string
}

const EMPTY_FORM: FormState = { handle: '', venueName: '', notes: '' }

export default function AdminInstagramPage() {
  const [handles, setHandles] = useState<InstagramHandle[]>([])
  const [envOnly, setEnvOnly] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<{ venueName: string; notes: string }>({ venueName: '', notes: '' })

  const fetchHandles = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/instagram-handles')
      if (!response.ok) {
        setError('Failed to load Instagram handles')
        return
      }
      const data = await response.json()
      setHandles(data.handles)
      setEnvOnly(data.envOnly ?? [])
    } catch {
      setError('Failed to load Instagram handles')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHandles()
  }, [fetchHandles])

  const addHandle = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/admin/instagram-handles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Failed to add handle')
        return
      }
      setForm(EMPTY_FORM)
      setNotice(`Added @${data.handle.handle}. It will be included in the next Instagram scrape.`)
      await fetchHandles()
    } catch {
      setError('Failed to add handle')
    } finally {
      setSaving(false)
    }
  }

  const patchHandle = async (row: InstagramHandle, patch: Partial<Pick<InstagramHandle, 'enabled' | 'venueName' | 'notes'>>) => {
    setBusyId(row.id)
    setError('')
    try {
      const response = await fetch(`/api/admin/instagram-handles/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!response.ok) setError((await response.json()).error || 'Failed to update handle')
      await fetchHandles()
    } catch {
      setError('Failed to update handle')
    } finally {
      setBusyId(null)
    }
  }

  const deleteHandle = async (row: InstagramHandle) => {
    if (!confirm(`Remove @${row.handle} from the list? Posts already processed and their submissions are kept.`)) {
      return
    }
    setBusyId(row.id)
    setError('')
    try {
      const response = await fetch(`/api/admin/instagram-handles/${row.id}`, { method: 'DELETE' })
      if (!response.ok) setError((await response.json()).error || 'Failed to remove handle')
      await fetchHandles()
    } catch {
      setError('Failed to remove handle')
    } finally {
      setBusyId(null)
    }
  }

  const importFromEnv = async () => {
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/admin/instagram-handles/import-env', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Import failed')
        return
      }
      const imported: string[] = data.imported ?? []
      setNotice(
        imported.length > 0
          ? `Imported ${imported.length}: ${imported.map((h) => `@${h}`).join(', ')}. You can now remove INSTAGRAM_HANDLES from Vercel.`
          : data.message || 'Nothing to import; every env handle is already in the list.'
      )
      await fetchHandles()
    } catch {
      setError('Import failed')
    }
  }

  const startEdit = (row: InstagramHandle) => {
    setEditingId(row.id)
    setEditDraft({ venueName: row.venueName ?? '', notes: row.notes ?? '' })
  }

  const saveEdit = async (row: InstagramHandle) => {
    await patchHandle(row, editDraft)
    setEditingId(null)
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto" />
        <p className="text-stone-500 mt-4">Loading Instagram handles...</p>
      </div>
    )
  }

  const enabledCount = handles.filter((h) => h.enabled).length

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-stone-900">Instagram accounts</h1>
        <Link href="/admin/scrapers?source=Instagram" className="text-sm text-orange-600 hover:text-orange-700">
          View Instagram scraper logs →
        </Link>
      </div>
      <p className="text-stone-500 text-sm mb-6 max-w-2xl">
        Accounts the Instagram scraper watches for event posts. New posts are read by AI and land in{' '}
        <Link href="/admin/submissions" className="text-orange-600 hover:underline">Submissions</Link> for review.
        The scraper calls Apify at most once every few days and bills per post, so keep this list to accounts
        that actually announce events.
      </p>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {notice && <p className="text-green-700 text-sm mb-4">{notice}</p>}

      {envOnly.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-900">
          <p className="mb-2">
            {envOnly.length} {envOnly.length === 1 ? 'handle is' : 'handles are'} still only in the{' '}
            <code className="bg-amber-100 px-1 rounded">INSTAGRAM_HANDLES</code> env var:{' '}
            {envOnly.map((h) => `@${h}`).join(', ')}. They are still scraped, but can&apos;t be managed here until imported.
          </p>
          <button
            onClick={importFromEnv}
            className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
          >
            Import from env
          </button>
        </div>
      )}

      {/* Add form */}
      <form onSubmit={addHandle} className="bg-white rounded-xl border border-stone-200 p-6 mb-6">
        <h2 className="font-semibold text-stone-900 mb-4">Add an account</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-stone-700">Instagram handle</span>
            <div className="mt-1 flex items-center rounded-lg border border-stone-300 focus-within:ring-2 focus-within:ring-orange-500 focus-within:border-orange-500">
              <span className="pl-3 text-stone-400">@</span>
              <input
                id="instagram-handle"
                type="text"
                required
                value={form.handle}
                onChange={(e) => setForm({ ...form, handle: e.target.value })}
                placeholder="nyacklibrary"
                className="w-full px-2 py-2 rounded-lg outline-none"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-stone-700">Venue name <span className="text-stone-400 font-normal">(optional)</span></span>
            <input
              id="instagram-venue"
              type="text"
              value={form.venueName}
              onChange={(e) => setForm({ ...form, venueName: e.target.value })}
              placeholder="Nyack Library"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            />
            <span className="text-xs text-stone-500">Used when a post doesn&apos;t say where the event is.</span>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-stone-700">Notes <span className="text-stone-400 font-normal">(optional)</span></span>
            <input
              id="instagram-notes"
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Storytimes, author readings"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            />
          </label>
        </div>
        <div className="mt-4">
          <button
            type="submit"
            disabled={saving || !form.handle.trim()}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Adding...' : 'Add account'}
          </button>
        </div>
      </form>

      {/* List */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
          <h2 className="font-semibold text-stone-900">
            Monitored accounts <span className="text-stone-400 font-normal">({enabledCount} enabled of {handles.length})</span>
          </h2>
        </div>
        {handles.length === 0 ? (
          <p className="px-4 py-8 text-center text-stone-500 text-sm">No accounts yet. Add one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">Account</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">Venue hint</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-stone-600">Posts read</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-stone-600">Events found</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">Last post</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-stone-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {handles.map((row) => {
                  const busy = busyId === row.id
                  const editing = editingId === row.id
                  return (
                    <tr key={row.id} className={row.enabled ? '' : 'bg-stone-50 text-stone-400'}>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <a
                            href={`https://www.instagram.com/${row.handle}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-stone-900 hover:text-orange-600"
                          >
                            @{row.handle}
                          </a>
                          {!row.enabled && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-stone-200 text-stone-600">paused</span>
                          )}
                          {row.inEnv && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800"
                              title="Also listed in INSTAGRAM_HANDLES, so pausing here won't stop it until the env var is updated"
                            >
                              env
                            </span>
                          )}
                        </div>
                        {editing ? (
                          <input
                            id={`notes-${row.id}`}
                            type="text"
                            value={editDraft.notes}
                            onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })}
                            placeholder="Notes"
                            className="mt-2 w-full px-2 py-1 text-sm rounded border border-stone-300"
                          />
                        ) : (
                          row.notes && <p className="text-xs text-stone-500 mt-1">{row.notes}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-sm">
                        {editing ? (
                          <input
                            id={`venue-${row.id}`}
                            type="text"
                            value={editDraft.venueName}
                            onChange={(e) => setEditDraft({ ...editDraft, venueName: e.target.value })}
                            placeholder="Venue name"
                            className="w-full px-2 py-1 text-sm rounded border border-stone-300"
                          />
                        ) : (
                          row.venueName || <span className="text-stone-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-right tabular-nums">{row.postsProcessed}</td>
                      <td className="px-4 py-3 align-top text-sm text-right tabular-nums">{row.eventsExtracted}</td>
                      <td className="px-4 py-3 align-top text-sm text-stone-600">
                        {row.lastPostAt ? formatRelative(row.lastPostAt) : <span className="text-stone-400">never</span>}
                      </td>
                      <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                        {editing ? (
                          <>
                            <button
                              onClick={() => saveEdit(row)}
                              disabled={busy}
                              className="text-sm text-orange-600 hover:text-orange-700 mr-3 disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button onClick={() => setEditingId(null)} className="text-sm text-stone-500 hover:text-stone-700">
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(row)}
                              disabled={busy}
                              className="text-sm text-stone-600 hover:text-stone-900 mr-3 disabled:opacity-50"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => patchHandle(row, { enabled: !row.enabled })}
                              disabled={busy}
                              className="text-sm text-stone-600 hover:text-stone-900 mr-3 disabled:opacity-50"
                            >
                              {row.enabled ? 'Pause' : 'Resume'}
                            </button>
                            <button
                              onClick={() => deleteHandle(row)}
                              disabled={busy}
                              className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
