'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface DashboardStats {
  totalEvents: number
  upcomingEvents: number
  hiddenEvents: number
  totalActivities: number
  activeActivities: number
  recentScraperRuns: {
    sourceName: string
    status: string
    eventsFound: number
    eventsAdded: number
    runAt: string
  }[]
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const runScrapers = async () => {
    setScraping(true)
    try {
      const adminPassword = sessionStorage.getItem('admin_password') || ''
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'x-admin-password': adminPassword,
        },
      })
      if (response.ok) {
        // Refresh stats after scraping
        await fetchStats()
      } else {
        console.error('Scraping failed:', await response.text())
      }
    } catch (error) {
      console.error('Scraping failed:', error)
    } finally {
      setScraping(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
        <p className="text-stone-500 mt-4">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Dashboard</h1>
        <button
          onClick={runScrapers}
          disabled={scraping}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {scraping ? 'Scraping...' : 'Run Scrapers'}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Events"
          value={stats?.totalEvents ?? 0}
          href="/admin/events"
        />
        <StatCard
          label="Upcoming Events"
          value={stats?.upcomingEvents ?? 0}
          color="green"
        />
        <StatCard
          label="Hidden Events"
          value={stats?.hiddenEvents ?? 0}
          color="red"
          href="/admin/events?hidden=true"
        />
        <StatCard
          label="Activities"
          value={stats?.activeActivities ?? 0}
          href="/admin/activities"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h2 className="font-semibold text-stone-900 mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <Link
              href="/admin/events/new"
              className="block px-4 py-3 bg-stone-50 rounded-lg hover:bg-stone-100 transition-colors"
            >
              + Add Event Manually
            </Link>
            <Link
              href="/admin/activities/new"
              className="block px-4 py-3 bg-stone-50 rounded-lg hover:bg-stone-100 transition-colors"
            >
              + Add Activity
            </Link>
            <Link
              href="/admin/scrapers"
              className="block px-4 py-3 bg-stone-50 rounded-lg hover:bg-stone-100 transition-colors"
            >
              View Scraper Logs
            </Link>
          </div>
        </div>

        {/* Recent Scraper Runs */}
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h2 className="font-semibold text-stone-900 mb-4">Recent Scraper Runs</h2>
          {stats?.recentScraperRuns && stats.recentScraperRuns.length > 0 ? (
            <div className="space-y-2">
              {stats.recentScraperRuns.map((run, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between px-3 py-2 bg-stone-50 rounded-lg text-sm"
                >
                  <div>
                    <span className="font-medium">{run.sourceName}</span>
                    <span className="text-stone-500 ml-2">
                      {run.eventsFound} found, {run.eventsAdded} added
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      run.status === 'success'
                        ? 'bg-green-100 text-green-700'
                        : run.status === 'partial'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {run.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-stone-500 text-sm">No scraper runs yet</p>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  color = 'orange',
  href,
}: {
  label: string
  value: number
  color?: 'orange' | 'green' | 'red'
  href?: string
}) {
  const colorClasses = {
    orange: 'text-orange-600',
    green: 'text-green-600',
    red: 'text-red-600',
  }

  const content = (
    <div className="bg-white rounded-xl border border-stone-200 p-4">
      <p className="text-sm text-stone-500">{label}</p>
      <p className={`text-3xl font-bold ${colorClasses[color]}`}>{value}</p>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block hover:shadow-md transition-shadow rounded-xl">
        {content}
      </Link>
    )
  }

  return content
}
