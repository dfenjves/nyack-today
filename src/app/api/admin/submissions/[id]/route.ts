import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Category } from '@prisma/client'
import { parseEasternTime } from '@/lib/utils/timezone'

/**
 * PATCH /api/admin/submissions/[id]
 * Update a submission's editable fields before approval
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await request.json()

    const updateData: Record<string, unknown> = {}

    if (data.title !== undefined) updateData.title = data.title
    if (data.description !== undefined) updateData.description = data.description || null
    if (data.startDate !== undefined) updateData.startDate = parseEasternTime(data.startDate)
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? parseEasternTime(data.endDate) : null
    if (data.venue !== undefined) updateData.venue = data.venue
    if (data.address !== undefined) updateData.address = data.address || null
    if (data.city !== undefined) updateData.city = data.city
    if (data.category !== undefined) {
      if (!Object.values(Category).includes(data.category)) {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
      }
      updateData.category = data.category
    }
    if (data.price !== undefined) updateData.price = data.price || null
    if (data.isFree !== undefined) updateData.isFree = data.isFree
    if (data.isFamilyFriendly !== undefined) updateData.isFamilyFriendly = data.isFamilyFriendly
    if (data.sourceUrl !== undefined) updateData.sourceUrl = data.sourceUrl || null
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl || null

    const submission = await prisma.eventSubmission.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ submission })
  } catch (error) {
    console.error('Update submission error:', error)
    return NextResponse.json(
      { error: 'Failed to update submission' },
      { status: 500 }
    )
  }
}

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
