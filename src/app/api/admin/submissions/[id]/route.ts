import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * DELETE /api/admin/submissions/[id]
 * Delete a submission (for cleanup)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.eventSubmission.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete submission error:', error)
    return NextResponse.json(
      { error: 'Failed to delete submission' },
      { status: 500 }
    )
  }
}
