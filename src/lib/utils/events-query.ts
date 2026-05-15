import { prisma } from '@/lib/db'
import { Category, Event } from '@prisma/client'
import { getDateRange, getCustomDateRange, DateFilter } from '@/lib/utils/dates'
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
    return { start: new Date(), end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
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
