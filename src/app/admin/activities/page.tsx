'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Activity } from '@prisma/client'
import { categoryLabels } from '@/lib/utils/categories'
import { Category } from '@prisma/client'

type ActivityFilter = 'active' | 'all' | 'inactive'

export default function AdminActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ActivityFilter>('active')

  const fetchActivities = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter === 'active') {
        params.set('active', 'true')
      } else if (filter === 'inactive') {
        params.set('active', 'false')
      }
      params.set('limit', '200')

      const response = await fetch(`/api/admin/activities?${params}`)
      if (response.ok) {
        const data = await response.json()
        setActivities(data.activities)
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchActivities()
  }, [filter])

  const toggleActive = async (activity: Activity) => {
    try {
      const response = await fetch(`/api/admin/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !activity.isActive }),
      })

      if (response.ok) {
        setActivities((prev) =>
          prev.map((item) =>
            item.id === activity.id ? { ...item, isActive: !item.isActive } : item
          )
        )
      }
    } catch (error) {
      console.error('Failed to update activity:', error)
    }
  }

  const deleteActivity = async (activity: Activity) => {
    if (!confirm(`Delete "${activity.title}"? This cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/activities/${activity.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setActivities((prev) => prev.filter((item) => item.id !== activity.id))
      }
    } catch (error) {
      console.error('Failed to delete activity:', error)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Activities</h1>
        <Link
          href="/admin/activities/new"
          className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
        >
          + Add Activity
        </Link>
      </div>

      <div className="flex gap-2 mb-6">
        {(['active', 'all', 'inactive'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-orange-500 text-white'
                : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-stone-200">
          <p className="text-stone-500">No activities found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">
                  Activity
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600 hidden md:table-cell">
                  Category
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600 hidden sm:table-cell">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-stone-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {activities.map((activity) => (
                <tr key={activity.id} className={!activity.isActive ? 'bg-red-50' : ''}>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-stone-900 line-clamp-1">
                        {activity.title}
                      </p>
                      <p className="text-sm text-stone-500">
                        {activity.venue}, {activity.city}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-600 hidden md:table-cell">
                    {categoryLabels[activity.category as Category]}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {activity.isActive ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleActive(activity)}
                        className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                          activity.isActive
                            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {activity.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <Link
                        href={`/admin/activities/${activity.id}`}
                        className="px-3 py-1 bg-stone-100 text-stone-700 text-xs rounded font-medium hover:bg-stone-200 transition-colors"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => deleteActivity(activity)}
                        className="px-3 py-1 bg-red-100 text-red-700 text-xs rounded font-medium hover:bg-red-200 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
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
