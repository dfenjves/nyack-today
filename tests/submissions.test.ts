/**
 * Tests for deciding when a pending submission is entirely in the past.
 *
 * Run: npm test   (node --test via tsx)
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { isSubmissionPast, type SubmissionDates } from '../src/lib/utils/submissions'

const cutoff = new Date('2026-09-28T04:00:00Z') // midnight Eastern
const yesterday = new Date('2026-09-27T23:00:00Z')
const later = new Date('2026-09-28T23:00:00Z')

const submission = (overrides: Partial<SubmissionDates>): SubmissionDates => ({
  startDate: yesterday,
  endDate: null,
  additionalDates: [],
  isRecurring: false,
  recurrenceEndDate: null,
  ...overrides,
})

test('a one-off event before today is past', () => {
  assert.equal(isSubmissionPast(submission({}), cutoff), true)
})

test('an event later today is not past', () => {
  assert.equal(isSubmissionPast(submission({ startDate: later }), cutoff), false)
})

test('a multi-day event that ends today or later is not past', () => {
  assert.equal(isSubmissionPast(submission({ endDate: later }), cutoff), false)
})

test('an upcoming additional showing keeps the submission', () => {
  assert.equal(isSubmissionPast(submission({ additionalDates: [yesterday, later] }), cutoff), false)
  assert.equal(isSubmissionPast(submission({ additionalDates: [yesterday] }), cutoff), true)
})

test('recurring submissions expire only after their recurrence end date', () => {
  assert.equal(isSubmissionPast(submission({ isRecurring: true }), cutoff), false)
  assert.equal(
    isSubmissionPast(submission({ isRecurring: true, recurrenceEndDate: later }), cutoff),
    false
  )
  assert.equal(
    isSubmissionPast(submission({ isRecurring: true, recurrenceEndDate: yesterday }), cutoff),
    true
  )
})
