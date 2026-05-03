'use client'

import { useState, useEffect } from 'react'

interface Subscriber {
  id: string
  email: string
  isActive: boolean
  subscribedAt: string
  updatedAt: string
}

export default function AdminSubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [newEmail, setNewEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  const fetchSubscribers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/subscribers')
      if (response.ok) {
        const data = await response.json()
        setSubscribers(data.subscribers)
      }
    } catch (error) {
      console.error('Failed to fetch subscribers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSubscribers()
  }, [])

  const addSubscriber = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError('')
    setAdding(true)
    try {
      const response = await fetch('/api/admin/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail }),
      })
      const data = await response.json()
      if (response.ok) {
        setNewEmail('')
        fetchSubscribers()
      } else {
        setAddError(data.error || 'Failed to add subscriber')
      }
    } catch {
      setAddError('Failed to add subscriber')
    } finally {
      setAdding(false)
    }
  }

  const toggleActive = async (subscriber: Subscriber) => {
    try {
      const response = await fetch(`/api/admin/subscribers/${subscriber.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !subscriber.isActive }),
      })
      if (response.ok) {
        setSubscribers((prev) =>
          prev.map((s) => (s.id === subscriber.id ? { ...s, isActive: !s.isActive } : s))
        )
      }
    } catch (error) {
      console.error('Failed to toggle subscriber:', error)
    }
  }

  const deleteSubscriber = async (subscriber: Subscriber) => {
    if (!confirm(`Delete ${subscriber.email}? This cannot be undone.`)) return
    try {
      const response = await fetch(`/api/admin/subscribers/${subscriber.id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setSubscribers((prev) => prev.filter((s) => s.id !== subscriber.id))
      }
    } catch (error) {
      console.error('Failed to delete subscriber:', error)
    }
  }

  const filtered = subscribers.filter((s) => {
    if (filter === 'ACTIVE') return s.isActive
    if (filter === 'INACTIVE') return !s.isActive
    return true
  })

  const activeCount = subscribers.filter((s) => s.isActive).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Subscribers</h1>
          <p className="text-sm text-stone-500 mt-1">
            {activeCount} active of {subscribers.length} total
          </p>
        </div>
      </div>

      {/* Add subscriber */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 mb-6">
        <h2 className="font-semibold text-stone-900 mb-4">Add Subscriber</h2>
        <form onSubmit={addSubscriber} className="flex gap-3">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="email@example.com"
            required
            className="flex-1 px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            type="submit"
            disabled={adding || !newEmail.trim()}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {adding ? 'Adding...' : 'Add'}
          </button>
        </form>
        {addError && <p className="text-red-500 text-sm mt-2">{addError}</p>}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-orange-500 text-white'
                : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
            }`}
          >
            {f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-stone-200">
          <p className="text-stone-500">No subscribers found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="text-left px-4 py-3 font-medium text-stone-700">Email</th>
                <th className="text-left px-4 py-3 font-medium text-stone-700">Status</th>
                <th className="text-left px-4 py-3 font-medium text-stone-700">Subscribed</th>
                <th className="text-right px-4 py-3 font-medium text-stone-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map((subscriber) => (
                <tr key={subscriber.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 text-stone-900">{subscriber.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        subscriber.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {subscriber.isActive ? 'Active' : 'Unsubscribed'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-500">
                    {new Date(subscriber.subscribedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => toggleActive(subscriber)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                          subscriber.isActive
                            ? 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {subscriber.isActive ? 'Unsubscribe' : 'Resubscribe'}
                      </button>
                      <button
                        onClick={() => deleteSubscriber(subscriber)}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
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
