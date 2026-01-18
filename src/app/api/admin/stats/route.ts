import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * GET /api/admin/stats
 * Get dashboard statistics
 */
export async function GET() {
  try {
    const now = new Date()

    // Count events
    const [totalEvents, upcomingEvents, hiddenEvents] = await Promise.all([
      prisma.event.count(),
      prisma.event.count({
        where: {
          startDate: { gte: now },
          isHidden: false,
        },
      }),
      prisma.event.count({
        where: { isHidden: true },
      }),
    ])

    // Count activities
    const [totalActivities, activeActivities] = await Promise.all([
      prisma.activity.count(),
      prisma.activity.count({
        where: { isActive: true },
      }),
    ])

    // Get recent scraper runs
    const recentScraperRuns = await prisma.scraperLog.findMany({
      orderBy: { runAt: 'desc' },
      take: 5,
      select: {
        sourceName: true,
        status: true,
        eventsFound: true,
        eventsAdded: true,
        runAt: true,
      },
    })

    return NextResponse.json({
      totalEvents,
      upcomingEvents,
      hiddenEvents,
      totalActivities,
      activeActivities,
      recentScraperRuns,
    })
  } catch (error) {
    console.error('Stats API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
