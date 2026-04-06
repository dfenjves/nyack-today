import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * GET /api/admin/scrapers/[id]/events
 * Returns events that were added during a specific scraper run.
 * Events are matched by sourceName and createdAt within a 15-minute
 * window before the log's runAt timestamp.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const log = await prisma.scraperLog.findUnique({ where: { id } })
    if (!log) {
      return NextResponse.json({ error: 'Log not found' }, { status: 404 })
    }

    const windowStart = new Date(log.runAt.getTime() - 15 * 60 * 1000)
    const windowEnd = new Date(log.runAt.getTime() + 60 * 1000)

    const events = await prisma.event.findMany({
      where: {
        sourceName: log.sourceName,
        createdAt: { gte: windowStart, lte: windowEnd },
      },
      select: {
        id: true,
        title: true,
        startDate: true,
        venue: true,
        sourceUrl: true,
      },
      orderBy: { startDate: 'asc' },
    })

    return NextResponse.json({ events })
  } catch (error) {
    console.error('Scraper log events API error:', error)
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }
}
