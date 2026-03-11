import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

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

    // Create Event from submission
    const event = await prisma.event.create({
      data: {
        title: submission.title,
        description: submission.description,
        startDate: submission.startDate,
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
        // Recurrence fields
        isRecurring: submission.isRecurring,
        recurrenceDays: submission.recurrenceDays,
        recurrenceEndDate: submission.recurrenceEndDate,
      },
    })

    // Update submission status
    await prisma.eventSubmission.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        approvedEventId: event.id,
      },
    })

    return NextResponse.json({ event, submission })
  } catch (error) {
    console.error('Approve submission error:', error)
    return NextResponse.json(
      { error: 'Failed to approve submission' },
      { status: 500 }
    )
  }
}
