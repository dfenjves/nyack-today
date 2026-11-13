// Pure helpers for EventSubmission rows (no database access, unit-tested)

export interface SubmissionDates {
  startDate: Date
  endDate: Date | null
  additionalDates: Date[]
  isRecurring: boolean
  recurrenceEndDate: Date | null
}

/**
 * True when every occurrence of a submission is before `cutoff` (normally
 * the start of today in Eastern Time), so there is nothing left to approve.
 * A recurring submission with no end date never expires.
 */
export function isSubmissionPast(submission: SubmissionDates, cutoff: Date): boolean {
  if (submission.isRecurring) {
    if (!submission.recurrenceEndDate) return false
    if (submission.recurrenceEndDate >= cutoff) return false
  }

  const occurrences = [
    submission.startDate,
    submission.endDate,
    ...submission.additionalDates,
  ].filter((date): date is Date => date !== null)

  return occurrences.every((date) => date < cutoff)
}
