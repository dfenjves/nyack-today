import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * POST /api/admin/submissions/[id]/reject
 * Reject a submission with optional reason
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await request.json()

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

    // Update submission status
    const updated = await prisma.eventSubmission.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        rejectionReason: data.reason || null,
      },
    })

    return NextResponse.json({ submission: updated })
  } catch (error) {
    console.error('Reject submission error:', error)
    return NextResponse.json(
      { error: 'Failed to reject submission' },
      { status: 500 }
    )
  }
}
