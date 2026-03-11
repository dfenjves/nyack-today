import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Category } from '@prisma/client'
import { sendEventSubmissionEmail } from '@/lib/utils/email'

/**
 * POST /api/submit-event
 * Public endpoint for users to submit events
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    // Validate required fields
    if (!data.title || !data.startDate || !data.venue || !data.submitterEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: title, startDate, venue, submitterEmail' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(data.submitterEmail)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    // Validate category if provided
    if (data.category && !Object.values(Category).includes(data.category)) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      )
    }

    // Validate date is not in the past (only for one-time events)
    const startDate = new Date(data.startDate)
    const now = new Date()
    if (!data.isRecurring && startDate < now) {
      return NextResponse.json(
        { error: 'Event date must be in the future' },
        { status: 400 }
      )
    }

    // Validate recurring event fields if applicable
    if (data.isRecurring) {
      // Must have at least one day selected
      if (!data.recurrenceDays || data.recurrenceDays.length === 0) {
        return NextResponse.json(
          { error: 'Must select at least one day for recurring events' },
          { status: 400 }
        )
      }

      // Validate day values are 0-6
      if (data.recurrenceDays.some((d: number) => d < 0 || d > 6)) {
        return NextResponse.json(
          { error: 'Invalid recurrence days' },
          { status: 400 }
        )
      }

      // Validate recurrence end date is after start date
      if (data.recurrenceEndDate) {
        const recurrenceEndDate = new Date(data.recurrenceEndDate)
        if (recurrenceEndDate <= startDate) {
          return NextResponse.json(
            { error: 'Recurrence end date must be after start date' },
            { status: 400 }
          )
        }
      }
    }

    // Create submission
    const submission = await prisma.eventSubmission.create({
      data: {
        title: data.title,
        description: data.description || null,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        venue: data.venue,
        address: data.address || null,
        city: data.city || 'Nyack',
        category: data.category || 'OTHER',
        price: data.price || null,
        isFree: data.isFree ?? false,
        isFamilyFriendly: data.isFamilyFriendly ?? false,
        sourceUrl: data.sourceUrl || null,
        imageUrl: data.imageUrl || null,
        submitterEmail: data.submitterEmail,
        status: 'PENDING',
        // Recurrence fields
        isRecurring: data.isRecurring ?? false,
        recurrenceDays: data.recurrenceDays || [],
        recurrenceEndDate: data.recurrenceEndDate ? new Date(data.recurrenceEndDate) : null,
      },
    })

    // Send email notification (graceful degradation - don't fail submission if email fails)
    try {
      await sendEventSubmissionEmail(submission)
    } catch (emailError) {
      console.error('Failed to send submission notification:', emailError)
    }

    return NextResponse.json({ submission }, { status: 201 })
  } catch (error) {
    console.error('Submit event error:', error)
    return NextResponse.json(
      { error: 'Failed to submit event' },
      { status: 500 }
    )
  }
}
