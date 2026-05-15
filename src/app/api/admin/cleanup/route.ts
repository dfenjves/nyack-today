import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * POST /api/admin/cleanup
 * Delete past non-recurring events and old scraper logs to keep the DB lean.
 *
 * Body (all optional):
 * - daysOld: delete events whose startDate is older than this many days (default: 1)
 * - deleteScraperLogs: also prune scraper logs older than 30 days (default: true)
 * - dryRun: if true, only count affected rows without deleting (default: false)
 */
export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const authHeader = request.headers.get('authorization')

  if (!adminPassword || authHeader !== `Bearer ${adminPassword}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    // empty body is fine
  }

  const daysOld = typeof body.daysOld === 'number' ? body.daysOld : 1
  const deleteScraperLogs = body.deleteScraperLogs !== false
  const dryRun = body.dryRun === true

  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000)
  const logCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  if (dryRun) {
    const [eventCount, logCount] = await Promise.all([
      prisma.event.count({
        where: { isRecurring: false, startDate: { lt: cutoff } },
      }),
      deleteScraperLogs
        ? prisma.scraperLog.count({ where: { runAt: { lt: logCutoff } } })
        : Promise.resolve(0),
    ])

    return NextResponse.json({
      dryRun: true,
      wouldDelete: { events: eventCount, scraperLogs: logCount },
      cutoffDate: cutoff.toISOString(),
    })
  }

  const [deletedEvents, deletedLogs] = await Promise.all([
    prisma.event.deleteMany({
      where: { isRecurring: false, startDate: { lt: cutoff } },
    }),
    deleteScraperLogs
      ? prisma.scraperLog.deleteMany({ where: { runAt: { lt: logCutoff } } })
      : Promise.resolve({ count: 0 }),
  ])

  return NextResponse.json({
    deleted: {
      events: deletedEvents.count,
      scraperLogs: deletedLogs.count,
    },
    cutoffDate: cutoff.toISOString(),
  })
}
