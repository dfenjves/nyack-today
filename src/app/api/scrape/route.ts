import { NextRequest, NextResponse } from 'next/server'
import {
  runAllScrapers,
  runScraper,
  cleanupOldEvents,
  getScraperNames,
  getStaticScrapers,
  getGenericScrapers,
  DEFAULT_GENERIC_BATCH_SIZE,
} from '@/lib/scrapers'
import type { OrchestratorResult } from '@/lib/scrapers'
import { notifyScraperError } from '@/lib/utils/notifications'

/**
 * POST /api/scrape
 * Trigger scraping of event sources
 *
 * A full run no longer fits in one Vercel invocation (300 s cap), so the daily
 * GitHub Actions workflow calls this route several times, one bounded group per
 * call. See .github/workflows/daily-scrape.yml.
 *
 * Query params:
 * - source: Run a specific scraper (e.g., "Visit Nyack"). Takes precedence
 *   over `group`.
 * - group: "static" runs only the statically registered scrapers; "generic"
 *   runs only the enabled Sources from /admin/sources. Omit for everything,
 *   which is the pre-split behavior.
 * - batch / batchSize: with group=generic, run the Nth (0-based) slice of the
 *   enabled Sources, ordered by name. The response carries
 *   `{ batch, batchSize, totalSources, hasMore }` so the caller can page.
 * - cleanup: Set to "true" to also cleanup old events. This must happen exactly
 *   once per day, so it is honored only when `group` is absent or
 *   `group=static` — i.e. on the first call of the daily sequence — and
 *   ignored on the generic batches that follow.
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
    const group = searchParams.get('group')

    if (group && group !== 'static' && group !== 'generic') {
      return NextResponse.json(
        { error: `Unknown group: ${group}. Expected "static" or "generic".` },
        { status: 400 }
      )
    }

    // Cleanup deletes events older than 7 days and only needs to run once a
    // day. The daily workflow makes several calls, so pin it to the first one.
    const cleanupRequested = searchParams.get('cleanup') === 'true'
    const cleanup = cleanupRequested && (!group || group === 'static')
    if (cleanup) {
      const cleaned = await cleanupOldEvents()
      console.log(`Cleaned up ${cleaned} old events`)
    } else if (cleanupRequested) {
      console.log(`Skipping cleanup for group=${group}; it runs with group=static`)
    }

    // A named source wins over a group: one scraper, run on its own.
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
          eventsFound: result.eventsFound ?? result.events.length,
          errorMessage: result.errorMessage,
          durationMs: result.durationMs,
        },
      })
    }

    if (group === 'generic') {
      const batch = parseNonNegativeInt(searchParams.get('batch')) ?? 0
      const batchSize =
        parseNonNegativeInt(searchParams.get('batchSize')) || DEFAULT_GENERIC_BATCH_SIZE

      const page = await getGenericScrapers({ batch, batchSize })
      const label = `generic batch ${page.batch}`

      // A batch past the end is not an error — a paging loop that overshoots
      // should just see an empty result and stop.
      const result = await runAllScrapers(page.scrapers, { groupLabel: label })

      return NextResponse.json({
        message: `Generic sources completed (batch ${page.batch}, ${page.scrapers.length} of ${page.totalSources})`,
        group: 'generic',
        batch: page.batch,
        batchSize: page.batchSize,
        totalSources: page.totalSources,
        hasMore: page.hasMore,
        ...summarize(result),
      })
    }

    const scrapersToRun = group === 'static' ? getStaticScrapers() : undefined
    const result = await runAllScrapers(scrapersToRun, {
      groupLabel: group === 'static' ? 'static' : undefined,
    })

    return NextResponse.json({
      message: group === 'static' ? 'Static scrapers completed' : 'All scrapers completed',
      ...(group === 'static' ? { group: 'static' } : {}),
      ...summarize(result),
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

/** A query param that must be a whole number >= 0; anything else is ignored. */
function parseNonNegativeInt(value: string | null): number | null {
  if (value === null) return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) return null
  return parsed
}

/** The summary + per-scraper shape the workflow's jq expressions read. */
function summarize(result: OrchestratorResult) {
  return {
    summary: {
      totalEventsFound: result.totalEventsFound,
      totalEventsAdded: result.totalEventsAdded,
      totalEventsUpdated: result.totalEventsUpdated,
      totalEventsDuplicate: result.totalEventsDuplicate,
      totalDurationMs: result.totalDurationMs,
      scrapersRun: result.results.length,
    },
    results: result.results.map((r) => ({
      sourceName: r.sourceName,
      status: r.status,
      eventsFound: r.eventsFound ?? r.events.length,
      errorMessage: r.errorMessage,
      durationMs: r.durationMs ?? 0,
    })),
  }
}

// GET is called by Vercel cron jobs to trigger scraping, and by the admin
// dashboard to fetch the list of available scrapers for the filter dropdown.
export async function GET(request: NextRequest) {
  const cronHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET || process.env.SCRAPER_API_KEY
  const adminPassword = request.headers.get('x-admin-password')

  const hasValidCron = Boolean(cronSecret) && cronHeader === `Bearer ${cronSecret}`
  const hasValidAdmin = Boolean(process.env.ADMIN_PASSWORD && adminPassword === process.env.ADMIN_PASSWORD)

  // A cron/authorized trigger runs the scrapers.
  if (hasValidCron || hasValidAdmin) {
    return POST(request)
  }

  // Otherwise, return the list of available scrapers for the admin dropdown —
  // static scrapers plus every enabled Source from /admin/sources.
  return NextResponse.json({ scrapers: await getScraperNames() })
}
