import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * POST /api/admin/events/[id]/duplicate
 * Create a copy of an existing event. The copy is hidden by default so it
 * doesn't publish with the original's date before an admin adjusts it.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const original = await prisma.event.findUnique({
      where: { id },
    })

    if (!original) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    const event = await prisma.event.create({
      data: {
        title: original.title,
        description: original.description,
        startDate: original.startDate,
        endDate: original.endDate,
        venue: original.venue,
        address: original.address,
        city: original.city,
        isNyackProper: original.isNyackProper,
        category: original.category,
        price: original.price,
        isFree: original.isFree,
        isFamilyFriendly: original.isFamilyFriendly,
        sourceUrl: original.sourceUrl,
        sourceName: original.sourceName,
        imageUrl: original.imageUrl,
        isMarquee: original.isMarquee,
        isRecurring: original.isRecurring,
        recurrenceDays: original.recurrenceDays,
        recurrenceEndDate: original.recurrenceEndDate,
        // Hidden by default so the copy isn't publicly listed until reviewed.
        isHidden: true,
        // sourceHash is unique and is left null to avoid a constraint clash.
        sourceHash: null,
      },
    })

    return NextResponse.json({ event }, { status: 201 })
  } catch (error) {
    console.error('Duplicate event error:', error)
    return NextResponse.json(
      { error: 'Failed to duplicate event' },
      { status: 500 }
    )
  }
}
