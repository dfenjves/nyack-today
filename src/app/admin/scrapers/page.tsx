'use client'

import { useEffect, useState } from 'react'

interface ScraperLog {
  id: string
  sourceName: string
  status: string
  eventsFound: number
  eventsAdded: number
  errorMessage: string | null
  runAt: string
}

export default function AdminScrapersPage() {
  const [logs, setLogs] = useState<ScraperLog[]>([])
  const [scrapers, setScrapers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [selectedScraper, setSelectedScraper] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [error, setError] = useState('')

  const fetchScrapers = async () => {
    try {
      const response = await fetch('/api/scrape')
      if (response.ok) {
        const data = await response.json()
        setScrapers(data.scrapers || [])
      }
    } catch (fetchError) {
      console.error('Failed to fetch scrapers:', fetchError)
    }
  }

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.set('status', statusFilter)
      }
      if (selectedScraper !== 'all') {
        params.set('source', selectedScraper)
      }
      params.set('limit', '100')

      const response = await fetch(`/api/admin/scrapers?${params}`)
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs)
      }
    } catch (fetchError) {
      console.error('Failed to fetch scraper logs:', fetchError)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchScrapers()
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [selectedScraper, statusFilter])

  const runScraper = async (source?: string) => {
    setRunning(true)
    setError('')
    try {
      const url = source ? `/api/scrape?source=${encodeURIComponent(source)}` : '/api/scrape'
      const response = await fetch(url, { method: 'POST' })
      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to run scraper')
      }
      await fetchLogs()
    } catch {
      setError('Failed to run scraper')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Scrapers</h1>
          <p className="text-sm text-stone-500">Run scrapers and review recent logs</p>
        </div>
        <button
          onClick={() => runScraper()}
          disabled={running}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {running ? 'Running...' : 'Run All Scrapers'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={selectedScraper}
          onChange={(e) => setSelectedScraper(e.target.value)}
          className="px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="all">All Scrapers</option>
          {scrapers.map((scraper) => (
            <option key={scraper} value={scraper}>
              {scraper}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="all">All Statuses</option>
          <option value="success">Success</option>
          <option value="partial">Partial</option>
          <option value="error">Error</option>
        </select>

        {selectedScraper !== 'all' && (
          <button
            onClick={() => runScraper(selectedScraper)}
            disabled={running}
            className="px-4 py-2 bg-stone-100 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-200 disabled:opacity-50 transition-colors"
          >
            {running ? 'Running...' : `Run ${selectedScraper}`}
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-stone-200">
          <p className="text-stone-500">No scraper runs yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">
                  Source
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600 hidden md:table-cell">
                  Run At
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">
                  Results
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600 hidden sm:table-cell">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-stone-900">{log.sourceName}</p>
                    {log.errorMessage && (
                      <p className="text-xs text-red-600 mt-1 line-clamp-2">
                        {log.errorMessage}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-600 hidden md:table-cell">
                    {new Date(log.runAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-600">
                    {log.eventsFound} found, {log.eventsAdded} added
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        log.status === 'success'
                          ? 'bg-green-100 text-green-700'
                          : log.status === 'partial'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
