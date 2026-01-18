import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Category } from '@/generated/prisma/enums'

/**
 * GET /api/admin/activities/[id]
 * Fetch a single activity
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const activity = await prisma.activity.findUnique({
      where: { id },
    })

    if (!activity) {
      return NextResponse.json(
        { error: 'Activity not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ activity })
  } catch (error) {
    console.error('Get activity error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activity' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/activities/[id]
 * Update an activity
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
    if (data.description !== undefined) updateData.description = data.description
    if (data.venue !== undefined) updateData.venue = data.venue
    if (data.address !== undefined) updateData.address = data.address
    if (data.city !== undefined) updateData.city = data.city
    if (data.isNyackProper !== undefined) updateData.isNyackProper = data.isNyackProper
    if (data.category !== undefined) {
      if (!Object.values(Category).includes(data.category)) {
        return NextResponse.json(
          { error: 'Invalid category' },
          { status: 400 }
        )
      }
      updateData.category = data.category
    }
    if (data.price !== undefined) updateData.price = data.price
    if (data.isFree !== undefined) updateData.isFree = data.isFree
    if (data.isFamilyFriendly !== undefined) updateData.isFamilyFriendly = data.isFamilyFriendly
    if (data.hours !== undefined) updateData.hours = data.hours
    if (data.websiteUrl !== undefined) updateData.websiteUrl = data.websiteUrl
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    const activity = await prisma.activity.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ activity })
  } catch (error) {
    console.error('Update activity error:', error)
    return NextResponse.json(
      { error: 'Failed to update activity' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/activities/[id]
 * Delete an activity
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.activity.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete activity error:', error)
    return NextResponse.json(
      { error: 'Failed to delete activity' },
      { status: 500 }
    )
  }
}
