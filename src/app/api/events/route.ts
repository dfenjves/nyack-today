import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Category, Event } from '@prisma/client'
import { getDateRange, getCustomDateRange, DateFilter } from '@/lib/utils/dates'
import { areEventsDuplicates } from '@/lib/scrapers/utils'
import { generateRecurringInstances } from '@/lib/utils/recurrence'

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
    const customDateParam = searchParams.get('customDate')
    if (dateFilter === 'custom' && customDateParam) {
      const customDate = new Date(customDateParam)
      const { start, end } = getCustomDateRange(customDate)
      where.startDate = { gte: start, lte: end }
    } else if (dateFilter && dateFilter !== 'custom') {
      const { start, end } = getDateRange(dateFilter)
      where.startDate = { gte: start, lte: end }
    } else {
      // Default to future events only
      where.startDate = { gte: new Date() }
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

    // Get date range for recurring events query
    const { start, end } = (() => {
      if (dateFilter === 'custom' && customDateParam) {
        return getCustomDateRange(new Date(customDateParam))
      }
      if (dateFilter && dateFilter !== 'custom') {
        return getDateRange(dateFilter)
      }
      return { start: new Date(), end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
    })()

    // Fetch one-time events
    const oneTimeWhere = { ...where, isRecurring: false }
    const oneTimeEvents = await prisma.event.findMany({
      where: oneTimeWhere,
      orderBy: {
        startDate: 'asc',
      },
      take: Math.min(limit, 100), // Cap at 100
      skip: offset,
    })

    // Fetch recurring events that might have instances in the date range
    // Build where clause without the startDate filter from one-time events
    const { startDate: _ignored, ...baseFilters } = where
    const recurringEvents = await prisma.event.findMany({
      where: {
        ...baseFilters,
        isRecurring: true,
        startDate: { lte: end }, // Event started on or before range end
        OR: [
          { recurrenceEndDate: { gte: start } }, // Recurrence ends after range start
          { recurrenceEndDate: null }, // Or no end date (infinite)
        ],
      },
      orderBy: {
        startDate: 'asc',
      },
    })

    // Generate instances for recurring events within the date range
    const recurringInstances = recurringEvents.flatMap(event => {
      console.log('Generating instances for recurring event:', {
        title: event.title,
        isRecurring: event.isRecurring,
        recurrenceDays: event.recurrenceDays,
        startDate: event.startDate,
        recurrenceEndDate: event.recurrenceEndDate,
        dateRange: { start, end }
      })
      const instances = generateRecurringInstances(event, start, end)
      console.log(`Generated ${instances.length} instances`)
      return instances
    })

    // Combine one-time events and recurring instances
    const allEvents = [...oneTimeEvents, ...recurringInstances].sort(
      (a, b) => a.startDate.getTime() - b.startDate.getTime()
    )

    // Deduplicate events based on title, venue, and date
    const deduplicatedEvents = deduplicateEvents(allEvents)

    // Get total count for pagination
    const oneTimeTotal = await prisma.event.count({ where: oneTimeWhere })
    const recurringTotal = await prisma.event.count({
      where: {
        ...baseFilters,
        isRecurring: true,
        startDate: { lte: end },
        OR: [
          { recurrenceEndDate: { gte: start } },
          { recurrenceEndDate: null },
        ],
      },
    })
    const total = oneTimeTotal + recurringTotal

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
