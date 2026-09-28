import { prisma } from '@/lib/db'
import { getToday } from '@/lib/utils/dates'
import { isSubmissionPast } from '@/lib/utils/submissions'

/**
 * Delete PENDING submissions whose every date is before today (Eastern).
 * They can no longer be usefully approved and only clutter the review queue.
 * Approved and rejected submissions are kept as history.
 */
export async function deletePastPendingSubmissions(): Promise<number> {
  const today = getToday()

  // The database narrows to submissions that started before today; the
  // endDate / additionalDates / recurrence checks need the full row.
  const candidates = await prisma.eventSubmission.findMany({
    where: { status: 'PENDING', startDate: { lt: today } },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      additionalDates: true,
      isRecurring: true,
      recurrenceEndDate: true,
    },
  })

  const ids = candidates
    .filter((submission) => isSubmissionPast(submission, today))
    .map((submission) => submission.id)

  if (ids.length === 0) return 0

  const result = await prisma.eventSubmission.deleteMany({
    where: { id: { in: ids }, status: 'PENDING' },
  })

  console.log(`Deleted ${result.count} past pending submissions`)
  return result.count
}
