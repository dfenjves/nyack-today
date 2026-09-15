import { Category, Event } from '@prisma/client'
import { prisma } from '@/lib/db'
import { scrapers } from '@/lib/scrapers'
import { getCustomDateRange, getToday } from '@/lib/utils/dates'
import { deduplicateEvents } from '@/lib/utils/events-query'
import { generateRecurringInstances } from '@/lib/utils/recurrence'
import {
  COVERAGE_DAYS,
  PULSE_THRESHOLDS,
  PulseCoverageDay,
  PulseResponse,
  PulseSource,
  SourceStatus,
  getDayStatus,
} from '@/lib/utils/pulse'

const TIMEZONE = 'America/New_York'
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

// ScraperLog statuses written by src/lib/scrapers/index.ts are 'success',
// 'partial', and 'error'. A partial run still reached the source and saved what
// it could, so it counts as a success for staleness — the same rule the Discord
// and Instagram scrapers use when looking up their own last good run.
const SUCCESS_STATUSES = ['success', 'partial']

// The Instagram scraper logs 'success' with 0 events on days it deliberately
// skips calling Apify (see src/lib/scrapers/instagram.ts). That's not a scraper
// returning nothing, so it shouldn't be flagged 'zero'.
const SKIPPED_RUN_PREFIX = 'Skipped'

const easternDateKey = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const easternWeekday = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, weekday: 'short' })

export interface CoverageDayWindow {
  date: string
  weekday: string
  start: Date
  end: Date
}

/** 'YYYY-MM-DD' of the instant's Eastern calendar date. */
export function toEasternDateKey(date: Date): string {
  return easternDateKey.format(date)
}

/**
 * Eastern calendar-day boundaries for the coverage grid, today first.
 * Each day is anchored at noon so a DST change (at most one hour over 14 days)
 * can never push the anchor into a neighboring day.
 */
export function getCoverageWindow(todayStart: Date = getToday()): CoverageDayWindow[] {
  return Array.from({ length: COVERAGE_DAYS }, (_, i) => {
    const anchor = new Date(todayStart.getTime() + i * DAY_MS + 12 * HOUR_MS)
    const { start, end } = getCustomDateRange(anchor)
    return {
      date: toEasternDateKey(anchor),
      weekday: easternWeekday.format(anchor),
      start,
      end,
    }
  })
}

function emptyCategoryCounts(): Record<Category, number> {
  return Object.fromEntries(Object.values(Category).map((c) => [c, 0])) as Record<Category, number>
}

/**
 * Bucket events into the coverage grid. Pure (no DB) so it can be verified
 * directly. `oneTimeEvents` must already be filtered to the window and non-hidden;
 * `recurringEvents` are expanded here with the same helper queryEvents() uses.
 */
export function buildCoverage(
  days: CoverageDayWindow[],
  oneTimeEvents: Event[],
  recurringEvents: Event[]
): PulseResponse['coverage'] {
  const windowStart = days[0].start
  const windowEnd = days[days.length - 1].end

  const all = [
    ...oneTimeEvents,
    ...recurringEvents.flatMap((event) => generateRecurringInstances(event, windowStart, windowEnd)),
  ].sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

  // Bucket by Eastern calendar date (not UTC), then dedup within each day so the
  // count matches what the public site shows when that single day is selected.
  const buckets = new Map<string, Event[]>(days.map((d) => [d.date, []]))
  for (const event of all) {
    buckets.get(toEasternDateKey(event.startDate))?.push(event)
  }

  const coverageDays: PulseCoverageDay[] = days.map((day) => {
    const events = deduplicateEvents(buckets.get(day.date) ?? [])
    const byCategory = emptyCategoryCounts()
    for (const event of events) byCategory[event.category]++
    return {
      date: day.date,
      weekday: day.weekday,
      startUtc: day.start.toISOString(),
      endUtc: day.end.toISOString(),
      total: events.length,
      byCategory,
      familyFriendly: events.filter((e) => e.isFamilyFriendly).length,
      free: events.filter((e) => e.isFree).length,
      status: getDayStatus(events.length),
    }
  })

  const weekCategories = new Set<Category>()
  for (const day of coverageDays.slice(0, 7)) {
    for (const category of Object.values(Category)) {
      if (day.byCategory[category] > 0) weekCategories.add(category)
    }
  }

  const total = coverageDays.reduce((sum, d) => sum + d.total, 0)
  const other = coverageDays.reduce((sum, d) => sum + d.byCategory.OTHER, 0)

  return {
    days: coverageDays,
    categoriesWithEventsThisWeek: weekCategories.size,
    otherShare: total === 0 ? 0 : other / total,
  }
}

async function getCoverage(): Promise<PulseResponse['coverage']> {
  const days = getCoverageWindow()
  const start = days[0].start
  const end = days[days.length - 1].end

  // Mirrors queryEvents() but without its 100-row cap, so busy days aren't undercounted.
  const [oneTimeEvents, recurringEvents] = await Promise.all([
    prisma.event.findMany({
      where: { isHidden: false, isRecurring: false, startDate: { gte: start, lte: end } },
      orderBy: { startDate: 'asc' },
    }),
    prisma.event.findMany({
      where: {
        isHidden: false,
        isRecurring: true,
        startDate: { lte: end },
        OR: [{ recurrenceEndDate: { gte: start } }, { recurrenceEndDate: null }],
      },
      orderBy: { startDate: 'asc' },
    }),
  ])

  return buildCoverage(days, oneTimeEvents, recurringEvents)
}

const STATUS_RANK: Record<SourceStatus, number> = { never: 0, stale: 1, zero: 2, ok: 3 }

async function getSources(now: Date): Promise<PulseSource[]> {
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS)
  const thirtyDaysOut = new Date(now.getTime() + 30 * DAY_MS)

  const [lastRuns, lastSuccesses, addedFromLogs, createdEvents, upcoming] = await Promise.all([
    prisma.scraperLog.groupBy({ by: ['sourceName'], _max: { runAt: true } }),
    prisma.scraperLog.groupBy({
      by: ['sourceName'],
      where: { status: { in: SUCCESS_STATUSES } },
      _max: { runAt: true },
    }),
    prisma.scraperLog.groupBy({
      by: ['sourceName'],
      where: { runAt: { gte: sevenDaysAgo } },
      _sum: { eventsAdded: true },
    }),
    prisma.event.groupBy({
      by: ['sourceName'],
      where: { createdAt: { gte: sevenDaysAgo } },
      _count: { _all: true },
    }),
    // Counts stored rows; recurring parents aren't expanded here (the coverage grid does that).
    prisma.event.groupBy({
      by: ['sourceName'],
      where: { isHidden: false, startDate: { gte: now, lte: thirtyDaysOut } },
      _count: { _all: true },
    }),
  ])

  // One query for the latest run row of every source.
  const latestRows = lastRuns.length
    ? await prisma.scraperLog.findMany({
        where: {
          OR: lastRuns.flatMap((r) =>
            r._max.runAt ? [{ sourceName: r.sourceName, runAt: r._max.runAt }] : []
          ),
        },
        select: { sourceName: true, status: true, eventsFound: true, errorMessage: true, runAt: true },
      })
    : []

  const latestByName = new Map(latestRows.map((r) => [r.sourceName, r]))
  const lastSuccessByName = new Map(lastSuccesses.map((r) => [r.sourceName, r._max.runAt]))
  const addedLogByName = new Map(addedFromLogs.map((r) => [r.sourceName, r._sum.eventsAdded ?? 0]))
  const createdByName = new Map(createdEvents.map((r) => [r.sourceName, r._count._all]))
  const upcomingByName = new Map(upcoming.map((r) => [r.sourceName, r._count._all]))

  const registeredNames = scrapers.map((s) => s.name)
  const registeredSet = new Set(registeredNames)
  const unregisteredNames = [
    ...new Set([...lastRuns.map((r) => r.sourceName), ...upcoming.map((r) => r.sourceName)]),
  ].filter((name) => !registeredSet.has(name))

  const staleCutoff = now.getTime() - PULSE_THRESHOLDS.staleSourceDays * DAY_MS

  const build = (sourceName: string, registered: boolean): PulseSource => {
    const latest = latestByName.get(sourceName)
    const lastSuccessAt = lastSuccessByName.get(sourceName) ?? null

    let status: SourceStatus
    if (!latest) status = 'never'
    else if (!lastSuccessAt || lastSuccessAt.getTime() < staleCutoff) status = 'stale'
    else if (
      SUCCESS_STATUSES.includes(latest.status) &&
      latest.eventsFound === 0 &&
      !latest.errorMessage?.startsWith(SKIPPED_RUN_PREFIX)
    )
      status = 'zero'
    else status = 'ok'

    return {
      sourceName,
      registered,
      lastRunAt: latest?.runAt.toISOString() ?? null,
      lastSuccessAt: lastSuccessAt?.toISOString() ?? null,
      lastStatus: latest?.status ?? null,
      eventsFoundLastRun: latest?.eventsFound ?? 0,
      // Scrapers report what they added in their log rows (Discord/Email/Instagram
      // add submissions, not events, so Event.createdAt would miss them). Sources
      // without a scraper, like User Submission, only exist as Event rows.
      eventsAddedLast7Days: registered
        ? (addedLogByName.get(sourceName) ?? 0)
        : (createdByName.get(sourceName) ?? 0),
      upcomingEvents: upcomingByName.get(sourceName) ?? 0,
      status,
    }
  }

  const registered = registeredNames
    .map((name) => build(name, true))
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.sourceName.localeCompare(b.sourceName))
  const unregistered = unregisteredNames
    .map((name) => build(name, false))
    .sort((a, b) => a.sourceName.localeCompare(b.sourceName))

  return [...registered, ...unregistered]
}

async function getAudience(now: Date): Promise<PulseResponse['audience']> {
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS)

  const [subscribersActive, subscribersLast7Days, devicesActive, devicesLast7Days, submissionsLast7Days, submissionsPending] =
    await Promise.all([
      prisma.subscriber.count({ where: { isActive: true } }),
      prisma.subscriber.count({ where: { isActive: true, subscribedAt: { gte: sevenDaysAgo } } }),
      prisma.device.count({ where: { isActive: true } }),
      prisma.device.count({ where: { isActive: true, createdAt: { gte: sevenDaysAgo } } }),
      prisma.eventSubmission.count({ where: { submittedAt: { gte: sevenDaysAgo } } }),
      prisma.eventSubmission.count({ where: { status: 'PENDING' } }),
    ])

  return { subscribersActive, subscribersLast7Days, devicesActive, devicesLast7Days, submissionsLast7Days, submissionsPending }
}

export async function getPulse(): Promise<PulseResponse> {
  const now = new Date()
  const [coverage, sources, audience] = await Promise.all([getCoverage(), getSources(now), getAudience(now)])
  return {
    generatedAt: now.toISOString(),
    timezone: TIMEZONE,
    coverage,
    sources,
    audience,
  }
}
