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

const toLocalDateInput = (isoString: string) => {
  const d = new Date(isoString)
  const local = new Date(d)
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
  return local.toISOString().slice(0, 10)
}

const toLocalTimeInput = (isoString: string) => {
  const d = new Date(isoString)
  const local = new Date(d)
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
  return local.toISOString().slice(11, 16)
}

export default function AdminSubmissionsPage() {
  const [submissions, setSubmissions] = useState<EventSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<SubmissionStatus | 'ALL'>('PENDING')
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)

  // Edit modal state
  const [editingSubmission, setEditingSubmission] = useState<EventSubmission | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    venue: '',
    address: '',
    city: 'Nyack',
    category: 'OTHER' as Category,
    price: '',
    isFree: false,
    isFamilyFriendly: false,
    sourceUrl: '',
    imageUrl: '',
    isRecurring: false,
    recurrenceDays: [] as number[],
    recurrenceEndDate: '',
  })

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

  const openEditModal = (submission: EventSubmission) => {
    setEditingSubmission(submission)
    setEditFormData({
      title: decodeHtmlEntities(submission.title),
      description: submission.description ? decodeHtmlEntities(submission.description) : '',
      startDate: toLocalDateInput(submission.startDate),
      startTime: toLocalTimeInput(submission.startDate),
      endDate: submission.endDate ? toLocalDateInput(submission.endDate) : '',
      endTime: submission.endDate ? toLocalTimeInput(submission.endDate) : '',
      venue: decodeHtmlEntities(submission.venue),
      address: submission.address ? decodeHtmlEntities(submission.address) : '',
      city: decodeHtmlEntities(submission.city),
      category: submission.category,
      price: submission.price || '',
      isFree: submission.isFree,
      isFamilyFriendly: submission.isFamilyFriendly,
      sourceUrl: submission.sourceUrl || '',
      imageUrl: submission.imageUrl || '',
      isRecurring: submission.isRecurring,
      recurrenceDays: submission.recurrenceDays || [],
      recurrenceEndDate: submission.recurrenceEndDate ? toLocalDateInput(submission.recurrenceEndDate) : '',
    })
    setShowEditModal(true)
  }

  const updateEditField = (field: string, value: unknown) => {
    setEditFormData((prev) => ({ ...prev, [field]: value }))
  }

  const saveEdit = async () => {
    if (!editingSubmission) return
    setSavingEdit(true)

    try {
      const startDateTime = editFormData.startTime
        ? `${editFormData.startDate}T${editFormData.startTime}`
        : `${editFormData.startDate}T00:00`

      let endDateTime = null
      if (editFormData.endDate) {
        endDateTime = editFormData.endTime
          ? `${editFormData.endDate}T${editFormData.endTime}`
          : `${editFormData.endDate}T23:59`
      }

      const response = await fetch(`/api/admin/submissions/${editingSubmission.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editFormData.title,
          description: editFormData.description,
          startDate: startDateTime,
          endDate: endDateTime,
          venue: editFormData.venue,
          address: editFormData.address,
          city: editFormData.city,
          category: editFormData.category,
          price: editFormData.isFree ? null : editFormData.price || null,
          isFree: editFormData.isFree,
          isFamilyFriendly: editFormData.isFamilyFriendly,
          sourceUrl: editFormData.sourceUrl,
          imageUrl: editFormData.imageUrl,
          isRecurring: editFormData.isRecurring,
          recurrenceDays: editFormData.isRecurring ? editFormData.recurrenceDays : [],
          recurrenceEndDate: editFormData.isRecurring && editFormData.recurrenceEndDate
            ? editFormData.recurrenceEndDate
            : null,
        }),
      })

      if (response.ok) {
        setShowEditModal(false)
        setEditingSubmission(null)
        fetchSubmissions()
      } else {
        const data = await response.json()
        alert(`Failed to update: ${data.error}`)
      }
    } catch (error) {
      console.error('Failed to update submission:', error)
      alert('Failed to update submission')
    } finally {
      setSavingEdit(false)
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
                      onClick={() => openEditModal(submission)}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
                    >
                      Edit
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

      {/* Edit Submission Modal */}
      {showEditModal && editingSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-stone-200">
              <h2 className="text-xl font-bold text-stone-900">Edit Submission</h2>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingSubmission(null)
                }}
                className="text-stone-400 hover:text-stone-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-5 flex-1">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.title}
                  onChange={(e) => updateEditField('title', e.target.value)}
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editFormData.description}
                  onChange={(e) => updateEditField('description', e.target.value)}
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={editFormData.startDate}
                    onChange={(e) => updateEditField('startDate', e.target.value)}
                    className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={editFormData.startTime}
                    onChange={(e) => updateEditField('startTime', e.target.value)}
                    className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={editFormData.endDate}
                    onChange={(e) => updateEditField('endDate', e.target.value)}
                    className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={editFormData.endTime}
                    onChange={(e) => updateEditField('endTime', e.target.value)}
                    className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Recurring Event Section */}
              <div className="border border-stone-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-isRecurring"
                    checked={editFormData.isRecurring}
                    onChange={(e) => updateEditField('isRecurring', e.target.checked)}
                    className="rounded border-stone-300 text-orange-500 focus:ring-orange-500"
                  />
                  <label htmlFor="edit-isRecurring" className="text-sm font-medium text-stone-700">
                    Recurring event
                  </label>
                </div>

                {editFormData.isRecurring && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-2">
                        Repeats on
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => {
                          const isChecked = editFormData.recurrenceDays.includes(index)
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                const days = isChecked
                                  ? editFormData.recurrenceDays.filter((d) => d !== index)
                                  : [...editFormData.recurrenceDays, index].sort((a, b) => a - b)
                                updateEditField('recurrenceDays', days)
                              }}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                                isChecked
                                  ? 'bg-purple-500 text-white border-purple-500'
                                  : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-50'
                              }`}
                            >
                              {day}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">
                        Recurrence end date (optional)
                      </label>
                      <input
                        type="date"
                        value={editFormData.recurrenceEndDate}
                        onChange={(e) => updateEditField('recurrenceEndDate', e.target.value)}
                        className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Venue *
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.venue}
                  onChange={(e) => updateEditField('venue', e.target.value)}
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={editFormData.address}
                    onChange={(e) => updateEditField('address', e.target.value)}
                    className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={editFormData.city}
                    onChange={(e) => updateEditField('city', e.target.value)}
                    className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Category
                </label>
                <select
                  value={editFormData.category}
                  onChange={(e) => updateEditField('category', e.target.value)}
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="edit-isFree"
                    checked={editFormData.isFree}
                    onChange={(e) => updateEditField('isFree', e.target.checked)}
                    className="rounded border-stone-300 text-orange-500 focus:ring-orange-500"
                  />
                  <label htmlFor="edit-isFree" className="text-sm text-stone-700">
                    This is a free event
                  </label>
                </div>
                {!editFormData.isFree && (
                  <input
                    type="text"
                    placeholder="e.g., $20, $15-$30"
                    value={editFormData.price}
                    onChange={(e) => updateEditField('price', e.target.value)}
                    className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-isFamilyFriendly"
                  checked={editFormData.isFamilyFriendly}
                  onChange={(e) => updateEditField('isFamilyFriendly', e.target.checked)}
                  className="rounded border-stone-300 text-orange-500 focus:ring-orange-500"
                />
                <label htmlFor="edit-isFamilyFriendly" className="text-sm text-stone-700">
                  Family-friendly event
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Event URL
                </label>
                <input
                  type="url"
                  value={editFormData.sourceUrl}
                  onChange={(e) => updateEditField('sourceUrl', e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Image URL
                </label>
                <input
                  type="url"
                  value={editFormData.imageUrl}
                  onChange={(e) => updateEditField('imageUrl', e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-stone-200">
              <button
                onClick={saveEdit}
                disabled={savingEdit || !editFormData.title.trim() || !editFormData.startDate || !editFormData.venue.trim()}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingSubmission(null)
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
