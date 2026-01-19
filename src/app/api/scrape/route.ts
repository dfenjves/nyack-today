import { NextRequest, NextResponse } from 'next/server'
import { runAllScrapers, runScraper, cleanupOldEvents, scrapers } from '@/lib/scrapers'
import { notifyScraperError } from '@/lib/utils/notifications'

/**
 * POST /api/scrape
 * Trigger scraping of event sources
 *
 * Query params:
 * - source: Run a specific scraper (e.g., "Visit Nyack")
 * - cleanup: Set to "true" to also cleanup old events
 *
 * Authentication (one of):
 * - Header x-scraper-key: API key for cron jobs
 * - Header x-admin-password: Admin password for dashboard access
 */
export async function POST(request: NextRequest) {
  try {
    // Check for API key (cron jobs)
    const apiKey = request.headers.get('x-scraper-key')
    const expectedKey = process.env.SCRAPER_API_KEY

    // Check for admin password (dashboard)
    const adminPassword = request.headers.get('x-admin-password')
    const expectedAdminPassword = process.env.ADMIN_PASSWORD

    // Allow if: no API key configured, OR valid API key, OR valid admin password
    const hasValidApiKey = !expectedKey || apiKey === expectedKey
    const hasValidAdminAuth = Boolean(expectedAdminPassword && adminPassword && adminPassword === expectedAdminPassword)

    console.log('Scrape auth debug:', {
      hasApiKey: !!apiKey,
      hasExpectedKey: !!expectedKey,
      hasValidApiKey,
      hasAdminPassword: !!adminPassword,
      adminPasswordLength: adminPassword?.length || 0,
      hasExpectedAdminPassword: !!expectedAdminPassword,
      hasValidAdminAuth,
    })

    if (!hasValidApiKey && !hasValidAdminAuth) {
      return NextResponse.json(
        { error: 'Unauthorized', debug: { hasValidApiKey, hasValidAdminAuth, hasAdminPassword: !!adminPassword } },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source')
    const cleanup = searchParams.get('cleanup') === 'true'

    // Run cleanup if requested
    if (cleanup) {
      const cleaned = await cleanupOldEvents()
      console.log(`Cleaned up ${cleaned} old events`)
    }

    // Run specific scraper or all scrapers
    if (source) {
      const result = await runScraper(source)

      if (!result) {
        return NextResponse.json(
          { error: `Scraper not found: ${source}` },
          { status: 404 }
        )
      }

      return NextResponse.json({
        message: `Scraper ${source} completed`,
        result: {
          sourceName: result.sourceName,
          status: result.status,
          eventsFound: result.events.length,
          errorMessage: result.errorMessage,
        },
      })
    }

    // Run all scrapers
    const result = await runAllScrapers()

    return NextResponse.json({
      message: 'All scrapers completed',
      summary: {
        totalEventsFound: result.totalEventsFound,
        totalEventsAdded: result.totalEventsAdded,
        totalEventsUpdated: result.totalEventsUpdated,
        totalEventsDuplicate: result.totalEventsDuplicate,
      },
      results: result.results.map((r) => ({
        sourceName: r.sourceName,
        status: r.status,
        eventsFound: r.events.length,
        errorMessage: r.errorMessage,
      })),
    })
  } catch (error) {
    console.error('Scrape error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'

    // Send critical error notification
    await notifyScraperError(message)

    return NextResponse.json(
      { error: 'Scraping failed', message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/scrape
 * Get list of available scrapers
 */
export async function GET() {
  return NextResponse.json({
    scrapers: scrapers.map((s) => s.name),
    usage: {
      runAll: 'POST /api/scrape',
      runOne: 'POST /api/scrape?source=Visit%20Nyack',
      withCleanup: 'POST /api/scrape?cleanup=true',
    },
  })
}
