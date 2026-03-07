import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Category, Event } from '@prisma/client'
import { getDateRange, DateFilter } from '@/lib/utils/dates'
import { areEventsDuplicates } from '@/lib/scrapers/utils'

/**
 * Deduplicate events using fuzzy matching
 * Keeps the first occurrence of each unique event
 */
function deduplicateEvents(events: Event[]): Event[] {
  const deduplicated: Event[] = []

  for (const event of events) {
    // Check if this event is a duplicate of any already added event
    const isDuplicate = deduplicated.some(existingEvent =>
      areEventsDuplicates(
        event.title,
        event.venue,
        event.startDate,
        existingEvent.title,
        existingEvent.venue,
        existingEvent.startDate
      )
    )

    if (!isDuplicate) {
      deduplicated.push(event)
    }
  }

  return deduplicated
}

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

    // Parse query params
    const dateFilter = searchParams.get('date') as DateFilter | null
    const category = searchParams.get('category') as Category | null
    const free = searchParams.get('free') === 'true'
    const familyFriendly = searchParams.get('familyFriendly') === 'true'
    const nyackOnly = searchParams.get('nyackOnly') === 'true'
    const nearbyOnly = searchParams.get('nearbyOnly') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Build where clause
    const where: Record<string, unknown> = {
      isHidden: false,
    }

    // Date filter
    if (dateFilter) {
      const { start, end } = getDateRange(dateFilter)
      where.startDate = {
        gte: start,
        lte: end,
      }
    } else {
      // Default to future events only
      where.startDate = {
        gte: new Date(),
      }
    }

    // Category filter
    if (category && Object.values(Category).includes(category)) {
      where.category = category
    }

    // Free filter
    if (free) {
      where.isFree = true
    }

    // Family-friendly filter
    if (familyFriendly) {
      where.isFamilyFriendly = true
    }

    // Location filters
    if (nyackOnly) {
      where.isNyackProper = true
    } else if (nearbyOnly) {
      where.isNyackProper = false
    }

    // Fetch events
    const events = await prisma.event.findMany({
      where,
      orderBy: {
        startDate: 'asc',
      },
      take: Math.min(limit, 100), // Cap at 100
      skip: offset,
    })

    // Deduplicate events based on title, venue, and date
    const deduplicatedEvents = deduplicateEvents(events)

    // Get total count for pagination
    const total = await prisma.event.count({ where })

    return NextResponse.json({
      events: deduplicatedEvents,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + deduplicatedEvents.length < total,
      },
    })
  } catch (error) {
    console.error('Events API error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      { error: 'Failed to fetch events', message },
      { status: 500 }
    )
  }
}
