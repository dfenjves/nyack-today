'use client'

import { useState, useEffect } from 'react'
import { Category } from '@prisma/client'
import { categoryLabels } from '@/lib/utils/categories'
import { decodeHtmlEntities } from '@/lib/utils/text'
import { formatRecurrencePattern } from '@/lib/utils/recurrence-display'

type SubmissionStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

interface EventSubmission {
  id: string
  title: string
  description: string | null
  startDate: string
  endDate: string | null
  venue: string
  address: string | null
  city: string
  category: Category
  price: string | null
  isFree: boolean
  isFamilyFriendly: boolean
  sourceUrl: string | null
  imageUrl: string | null
  submitterEmail: string
  status: SubmissionStatus
  submittedAt: string
  reviewedAt: string | null
  rejectionReason: string | null
  approvedEventId: string | null
  // Recurrence fields
  isRecurring: boolean
  recurrenceDays: number[]
  recurrenceEndDate: string | null
}

export default function AdminSubmissionsPage() {
  const [submissions, setSubmissions] = useState<EventSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<SubmissionStatus | 'ALL'>('PENDING')
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)

  const fetchSubmissions = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'ALL') {
        params.set('status', filter)
      }

      const response = await fetch(`/api/admin/submissions?${params}`)
      if (response.ok) {
        const data = await response.json()
        setSubmissions(data.submissions)
      }
    } catch (error) {
      console.error('Failed to fetch submissions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSubmissions()
  }, [filter])

  const approveSubmission = async (submission: EventSubmission) => {
    if (!confirm(`Approve "${submission.title}"? This will create a new event.`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/submissions/${submission.id}/approve`, {
        method: 'POST',
      })

      if (response.ok) {
        fetchSubmissions()
      } else {
        const data = await response.json()
        alert(`Failed to approve: ${data.error}`)
      }
    } catch (error) {
      console.error('Failed to approve submission:', error)
      alert('Failed to approve submission')
    }
  }

  const openRejectModal = (submission: EventSubmission) => {
    setReviewingId(submission.id)
    setRejectionReason('')
    setShowRejectModal(true)
  }

  const rejectSubmission = async () => {
    if (!reviewingId) return

    try {
      const response = await fetch(`/api/admin/submissions/${reviewingId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason }),
      })

      if (response.ok) {
        setShowRejectModal(false)
        setReviewingId(null)
        setRejectionReason('')
        fetchSubmissions()
      } else {
        const data = await response.json()
        alert(`Failed to reject: ${data.error}`)
      }
    } catch (error) {
      console.error('Failed to reject submission:', error)
      alert('Failed to reject submission')
    }
  }

  const deleteSubmission = async (submission: EventSubmission) => {
    if (!confirm(`Delete submission "${submission.title}"? This cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/submissions/${submission.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setSubmissions((prev) => prev.filter((s) => s.id !== submission.id))
      }
    } catch (error) {
      console.error('Failed to delete submission:', error)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Event Submissions</h1>
        <div className="text-sm text-stone-600">
          {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-orange-500 text-white'
                : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
            }`}
          >
            {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
        </div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-stone-200">
          <p className="text-stone-500">No submissions found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map((submission) => (
            <div
              key={submission.id}
              className={`bg-white rounded-xl border-2 p-6 ${
                submission.status === 'PENDING'
                  ? 'border-orange-200'
                  : submission.status === 'APPROVED'
                  ? 'border-green-200'
                  : 'border-red-200'
              }`}
            >
              <div className="flex items-start gap-4 mb-4">
                {/* Event Image */}
                {submission.imageUrl && (
                  <div className="flex-shrink-0">
                    <img
                      src={submission.imageUrl}
                      alt={submission.title}
                      className="w-32 h-32 object-cover rounded-lg border border-stone-200"
                    />
                  </div>
                )}

                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-stone-900">
                      {decodeHtmlEntities(submission.title)}
                    </h3>
                    <span
                      className={`px-2 py-1 text-xs rounded-full font-medium ${
                        submission.status === 'PENDING'
                          ? 'bg-orange-100 text-orange-700'
                          : submission.status === 'APPROVED'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {submission.status}
                    </span>
                  </div>
                  {submission.description && (
                    <p className="text-stone-600 mb-3">
                      {decodeHtmlEntities(submission.description)}
                    </p>
                  )}
                </div>
              </div>

              {/* Recurring Event Badge */}
              {submission.isRecurring && submission.recurrenceDays && submission.recurrenceDays.length > 0 && (
                <div className="bg-purple-50 border-l-4 border-purple-500 rounded-r-lg p-4 mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-purple-700 font-semibold text-sm">🔁 Recurring Event</span>
                  </div>
                  <div className="text-sm text-purple-600">
                    {formatRecurrencePattern(
                      submission.recurrenceDays,
                      submission.recurrenceEndDate ? new Date(submission.recurrenceEndDate) : null
                    )}
                  </div>
                </div>
              )}

              {/* Debug info - remove later */}
              {process.env.NODE_ENV === 'development' && (
                <div className="text-xs text-gray-500 mb-2">
                  Debug: isRecurring={String(submission.isRecurring)}, days={JSON.stringify(submission.recurrenceDays)}
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4 mb-4 text-sm">
                <div>
                  <span className="font-medium text-stone-700">Date:</span>{' '}
                  <span className="text-stone-600">
                    {new Date(submission.startDate).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-stone-700">Venue:</span>{' '}
                  <span className="text-stone-600">
                    {decodeHtmlEntities(submission.venue)}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-stone-700">Location:</span>{' '}
                  <span className="text-stone-600">
                    {submission.address ? `${submission.address}, ` : ''}
                    {submission.city}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-stone-700">Category:</span>{' '}
                  <span className="text-stone-600">
                    {categoryLabels[submission.category]}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-stone-700">Price:</span>{' '}
                  <span className="text-stone-600">
                    {submission.isFree ? 'Free' : submission.price || 'Not specified'}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-stone-700">Family Friendly:</span>{' '}
                  <span className="text-stone-600">
                    {submission.isFamilyFriendly ? 'Yes' : 'No'}
                  </span>
                </div>
                {submission.sourceUrl && (
                  <div className="md:col-span-2">
                    <span className="font-medium text-stone-700">More Info:</span>{' '}
                    <a
                      href={submission.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-500 hover:text-orange-600 underline"
                    >
                      {submission.sourceUrl}
                    </a>
                  </div>
                )}
                {submission.imageUrl && (
                  <div className="md:col-span-2">
                    <span className="font-medium text-stone-700">Image:</span>{' '}
                    <a
                      href={submission.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-500 hover:text-orange-600 underline break-all"
                    >
                      {submission.imageUrl}
                    </a>
                  </div>
                )}
              </div>

              <div className="border-t border-stone-200 pt-4 mb-4">
                <div className="text-sm text-stone-600">
                  <div>
                    <span className="font-medium">Submitted by:</span>{' '}
                    {submission.submitterEmail}
                  </div>
                  <div>
                    <span className="font-medium">Submitted:</span>{' '}
                    {new Date(submission.submittedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </div>
                  {submission.rejectionReason && (
                    <div className="mt-2 p-2 bg-red-50 rounded">
                      <span className="font-medium text-red-700">Rejection reason:</span>{' '}
                      <span className="text-red-600">{submission.rejectionReason}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {submission.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => approveSubmission(submission)}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
                    >
                      Approve & Create Event
                    </button>
                    <button
                      onClick={() => openRejectModal(submission)}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
                    >
                      Reject
                    </button>
                  </>
                )}
                {submission.status === 'APPROVED' && submission.approvedEventId && (
                  <a
                    href={`/admin/events/${submission.approvedEventId}`}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
                  >
                    View Event
                  </a>
                )}
                <button
                  onClick={() => deleteSubmission(submission)}
                  className="px-4 py-2 bg-stone-100 text-stone-700 rounded-lg font-medium hover:bg-stone-200 transition-colors ml-auto"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-stone-900 mb-4">Reject Submission</h2>
            <p className="text-stone-600 mb-4">
              Please provide a reason for rejecting this submission:
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              placeholder="e.g., Event is outside Nyack area, duplicate submission, etc."
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={rejectSubmission}
                disabled={!rejectionReason.trim()}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                Reject Submission
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setReviewingId(null)
                  setRejectionReason('')
                }}
                className="px-4 py-2 bg-stone-100 text-stone-700 rounded-lg font-medium hover:bg-stone-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
