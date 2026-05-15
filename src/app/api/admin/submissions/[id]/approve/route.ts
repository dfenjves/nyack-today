import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendSubmissionApprovalEmail } from '@/lib/utils/email'

/**
 * POST /api/admin/submissions/[id]/approve
 * Approve a submission and create an Event from it
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Fetch submission
    const submission = await prisma.eventSubmission.findUnique({
      where: { id },
    })

    if (!submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      )
    }

    if (submission.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Submission has already been reviewed' },
        { status: 400 }
      )
    }

    const sharedEventData = {
      title: submission.title,
      description: submission.description,
      endDate: submission.endDate,
      venue: submission.venue,
      address: submission.address,
      city: submission.city,
      isNyackProper: true,
      category: submission.category,
      price: submission.price,
      isFree: submission.isFree,
      isFamilyFriendly: submission.isFamilyFriendly,
      sourceUrl: submission.sourceUrl || '',
      sourceName: 'User Submission',
      imageUrl: submission.imageUrl,
      isHidden: false,
      isRecurring: submission.isRecurring,
      recurrenceDays: submission.recurrenceDays,
      recurrenceEndDate: submission.recurrenceEndDate,
    }

    // Create one Event per showing date; primary date first
    const showingDates = [submission.startDate, ...submission.additionalDates]
    const createdEvents = await Promise.all(
      showingDates.map((startDate) =>
        prisma.event.create({ data: { ...sharedEventData, startDate } })
      )
    )
    const event = createdEvents[0]

    // Update submission status — link to first created event
    await prisma.eventSubmission.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        approvedEventId: event.id,
      },
    })

    // Send approval email to submitter (graceful degradation)
    try {
      const updatedSubmission = await prisma.eventSubmission.findUnique({
        where: { id },
      })

      if (updatedSubmission) {
        await sendSubmissionApprovalEmail(updatedSubmission, event)
      }
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError)
    }

    return NextResponse.json({ event, submission })
  } catch (error) {
    console.error('Approve submission error:', error)
    return NextResponse.json(
      { error: 'Failed to approve submission' },
      { status: 500 }
    )
  }
}
