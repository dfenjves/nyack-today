import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Category } from '@/generated/prisma/enums'

/**
 * GET /api/admin/events
 * Fetch events for admin management
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const hidden = searchParams.get('hidden') === 'true'
    const past = searchParams.get('past') === 'true'
    const upcoming = searchParams.get('upcoming') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const now = new Date()
    const where: Record<string, unknown> = {}

    if (hidden) {
      where.isHidden = true
    } else if (past) {
      where.startDate = { lt: now }
    } else if (upcoming) {
      where.startDate = { gte: now }
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: { startDate: upcoming ? 'asc' : 'desc' },
      take: Math.min(limit, 200),
    })

    return NextResponse.json({ events })
  } catch (error) {
    console.error('Admin events API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/events
 * Create a new event manually
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    // Validate required fields
    if (!data.title || !data.startDate || !data.venue) {
      return NextResponse.json(
        { error: 'Missing required fields: title, startDate, venue' },
        { status: 400 }
      )
    }

    // Validate category
    if (data.category && !Object.values(Category).includes(data.category)) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      )
    }

    const event = await prisma.event.create({
      data: {
        title: data.title,
        description: data.description || null,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        venue: data.venue,
        address: data.address || null,
        city: data.city || 'Nyack',
        isNyackProper: data.isNyackProper ?? true,
        category: data.category || 'OTHER',
        price: data.price || null,
        isFree: data.isFree ?? false,
        isFamilyFriendly: data.isFamilyFriendly ?? false,
        sourceUrl: data.sourceUrl || '',
        sourceName: 'Manual Entry',
        imageUrl: data.imageUrl || null,
        isHidden: false,
      },
    })

    return NextResponse.json({ event }, { status: 201 })
  } catch (error) {
    console.error('Create event error:', error)
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    )
  }
}
