import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Category } from '@/generated/prisma/enums'

/**
 * GET /api/admin/events/[id]
 * Fetch a single event
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const event = await prisma.event.findUnique({
      where: { id },
    })

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ event })
  } catch (error) {
    console.error('Get event error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/events/[id]
 * Update an event
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await request.json()

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {}

    if (data.title !== undefined) updateData.title = data.title
    if (data.description !== undefined) updateData.description = data.description
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate)
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null
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
    if (data.sourceUrl !== undefined) updateData.sourceUrl = data.sourceUrl
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl
    if (data.isHidden !== undefined) updateData.isHidden = data.isHidden

    const event = await prisma.event.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ event })
  } catch (error) {
    console.error('Update event error:', error)
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/events/[id]
 * Delete an event
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.event.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete event error:', error)
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    )
  }
}
