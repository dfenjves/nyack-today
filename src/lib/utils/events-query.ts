import { prisma } from '@/lib/db'
import { Category, Event } from '@prisma/client'
import { getDateRange, getCustomDateRange, getToday, DateFilter } from '@/lib/utils/dates'
import { areEventsDuplicates } from '@/lib/scrapers/utils'
import { generateRecurringInstances } from '@/lib/utils/recurrence'

export interface EventQueryOptions {
  dateFilter?: DateFilter | null
  customDate?: Date | null
  category?: Category | null
  free?: boolean
  familyFriendly?: boolean
  nyackOnly?: boolean
  nearbyOnly?: boolean
  marqueeOnly?: boolean
  limit?: number
  offset?: number
}

function deduplicateEvents(events: Event[]): Event[] {
  const deduplicated: Event[] = []
  for (const event of events) {
    const isDuplicate = deduplicated.some(existing =>
      areEventsDuplicates(
        event.title, event.venue, event.startDate,
        existing.title, existing.venue, existing.startDate,
      )
    )
    if (!isDuplicate) deduplicated.push(event)
  }
  return deduplicated
}

// Recurring-instance stable ids are formatted as `${parentId}-${YYYY-MM-DD}` in
// generateRecurringInstances(). cuids never contain hyphens, so a trailing
// `-YYYY-MM-DD` unambiguously marks a recurring occurrence.
const RECURRING_ID_PATTERN = /^(.+)-(\d{4}-\d{2}-\d{2})$/

/**
 * Resolve a single event by its stable id as returned from /api/events.
 *
 * Two id shapes are supported and must stay in sync with the ids emitted by
 * queryEvents():
 *  - A one-time event: the Prisma cuid.
 *  - A recurring occurrence: `${parentId}-${YYYY-MM-DD}`, materialized on the fly.
 *
 * Returns null for hidden/missing events and for dates that are not a valid
 * occurrence of a recurring event (callers should surface this as a 404).
 */
export async function getEventByStableId(stableId: string): Promise<Event | null> {
  const match = stableId.match(RECURRING_ID_PATTERN)

  if (match) {
    const [, parentId, date] = match
    const parent = await prisma.event.findUnique({ where: { id: parentId } })

    if (parent && !parent.isHidden && parent.isRecurring) {
      // Regenerate occurrences in a window around the target UTC day and match by
      // exact id so we reuse the same synthesis logic that produced the id. The
      // window spans +/- a day because the id suffix is the instance's UTC date,
      // which can differ from its Eastern calendar date for late-evening events.
      const target = new Date(`${date}T00:00:00.000Z`)
      const rangeStart = new Date(target.getTime() - 24 * 60 * 60 * 1000)
      const rangeEnd = new Date(target.getTime() + 2 * 24 * 60 * 60 * 1000)
      const instance = generateRecurringInstances(parent, rangeStart, rangeEnd).find(
        (i) => i.id === stableId
      )
      if (instance) return instance
    }

    // Matched the recurring shape but not a real occurrence — treat as not found
    // rather than falling through to a (guaranteed-null) direct lookup.
    return null
  }

  const event = await prisma.event.findUnique({ where: { id: stableId } })
  if (!event || event.isHidden) return null
  return event
}

export async function queryEvents(options: EventQueryOptions = {}): Promise<Event[]> {
  const {
    dateFilter,
    customDate,
    category,
    free,
    familyFriendly,
    nyackOnly,
    nearbyOnly,
    marqueeOnly,
    limit = 50,
    offset = 0,
  } = options

  const where: Record<string, unknown> = { isHidden: false }

  const { start, end } = (() => {
    if (dateFilter === 'custom' && customDate) return getCustomDateRange(customDate)
    if (dateFilter && dateFilter !== 'custom') return getDateRange(dateFilter)
    return { start: getToday(), end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
  })()

  if (dateFilter === 'custom' && customDate) {
    where.startDate = { gte: start, lte: end }
  } else if (dateFilter && dateFilter !== 'custom') {
    where.startDate = { gte: start, lte: end }
  } else {
    where.startDate = { gte: new Date() }
  }

  if (category && Object.values(Category).includes(category)) where.category = category
  if (free) where.isFree = true
  if (familyFriendly) where.isFamilyFriendly = true
  if (nyackOnly) where.isNyackProper = true
  else if (nearbyOnly) where.isNyackProper = false
  if (marqueeOnly) where.isMarquee = true

  const { startDate: _ignored, ...baseFilters } = where

  const [oneTimeEvents, recurringEvents] = await Promise.all([
    prisma.event.findMany({
      where: { ...where, isRecurring: false },
      orderBy: { startDate: 'asc' },
      take: Math.min(limit, 100),
      skip: offset,
    }),
    prisma.event.findMany({
      where: {
        ...baseFilters,
        isRecurring: true,
        startDate: { lte: end },
        OR: [
          { recurrenceEndDate: { gte: start } },
          { recurrenceEndDate: null },
        ],
      },
      orderBy: { startDate: 'asc' },
    }),
  ])

  const recurringInstances = recurringEvents.flatMap(event =>
    generateRecurringInstances(event, start, end)
  )

  return deduplicateEvents(
    [...oneTimeEvents, ...recurringInstances].sort(
      (a, b) => a.startDate.getTime() - b.startDate.getTime()
    )
  )
}
