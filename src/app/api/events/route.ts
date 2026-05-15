import { NextRequest, NextResponse } from 'next/server'
import { Category } from '@prisma/client'
import { DateFilter } from '@/lib/utils/dates'
import { queryEvents } from '@/lib/utils/events-query'
import { prisma } from '@/lib/db'

/**
 * GET /api/events
 * Fetch events with filtering
 *
 * Query params:
 * - date: DateFilter ('tonight' | 'tomorrow' | 'weekend' | 'week')
 * - category: Category enum value
 * - free: 'true' to show only free events
 * - familyFriendly: 'true' to show only family-friendly events
 * - nyackOnly: 'true' to show only Nyack-proper events
 * - nearbyOnly: 'true' to show only nearby (non-Nyack) events
 * - limit: Max number of events (default 50)
 * - offset: Pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const dateFilter = searchParams.get('date') as DateFilter | null
    const category = searchParams.get('category') as Category | null
    const free = searchParams.get('free') === 'true'
    const familyFriendly = searchParams.get('familyFriendly') === 'true'
    const nyackOnly = searchParams.get('nyackOnly') === 'true'
    const nearbyOnly = searchParams.get('nearbyOnly') === 'true'
    const marqueeOnly = searchParams.get('marquee') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const customDateParam = searchParams.get('customDate')
    const customDate = dateFilter === 'custom' && customDateParam ? new Date(customDateParam) : null

    const [events, total] = await Promise.all([
      queryEvents({
        dateFilter,
        customDate,
        category,
        free,
        familyFriendly,
        nyackOnly,
        nearbyOnly,
        marqueeOnly,
        limit,
        offset,
      }),
      prisma.event.count({ where: { isHidden: false } }),
    ])

    const response = NextResponse.json({
      events,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + events.length < total,
      },
    })

    // Cache for 60 seconds at the CDN, serve stale for up to 5 minutes while revalidating
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')

    return response
  } catch (error) {
    console.error('Events API error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      { error: 'Failed to fetch events', message },
      { status: 500 }
    )
  }
}
