import { prisma } from '@/lib/db'
import { Scraper, ScraperResult, ScrapedEvent } from './types'
import { generateEventHash, areEventsDuplicates } from './utils'
import { visitNyackScraper } from './visitnyack'
import { theAngelNyackScraper } from './theangelnyack'
import { eventbriteScraper } from './eventbrite'
import { levityLiveScraper } from './levitylive'
import { elmwoodPlayhouseScraper } from './elmwoodplayhouse'
import { rivertownFilmScraper } from './rivertownfilm'
import { nyackVillageScraper } from './nyackvillage'
import { emailScraper } from './email'
import { maureensJazzCellarScraper } from './maureensjazzcellar'
import { exploreRocklandScraper } from './explorerockland'
import { discordScraper } from './discord'
import { instagramScraper } from './instagram'
import { rocklandArtCenterScraper } from './rocklandartcenter'
import { olivesNyackScraper } from './olivesnyack'
import { rocklandChessScraper } from './rocklandchess'
import { patchScraper } from './patch'
import { nyackNewsAndViewsScraper } from './nyacknewsandviews'
import { enabledSources, genericSourceScrapers, makeSourceScraper } from './generic'
import { takeBatch, withTimeout } from './batching'
import { notifyScraperComplete, notifyScraperError } from '@/lib/utils/notifications'
import { categorizeScrapedEvents } from '@/lib/ai/categorize'

/**
 * All statically registered scrapers (one file each)
 */
export const scrapers: Scraper[] = [
  visitNyackScraper,
  theAngelNyackScraper,
  eventbriteScraper,
  levityLiveScraper,
  elmwoodPlayhouseScraper,
  rivertownFilmScraper,
  nyackVillageScraper,
  emailScraper,
  maureensJazzCellarScraper,
  exploreRocklandScraper,
  discordScraper,
  instagramScraper,
  rocklandArtCenterScraper,
  olivesNyackScraper,
  rocklandChessScraper,
  patchScraper,
  nyackNewsAndViewsScraper,
]

/**
 * Wall-clock budget for a scraper that doesn't declare its own `timeoutMs`,
 * i.e. every static scraper. Generic sources set theirs from their fetch mode
 * (`SOURCE_TIMEOUT_MS` in ./generic).
 */
export const DEFAULT_SCRAPER_TIMEOUT_MS = 90_000

/** Generic sources per batch when `/api/scrape?group=generic` is given no batchSize. */
export const DEFAULT_GENERIC_BATCH_SIZE = 4

/**
 * Every scraper for this run: the static ones above, then one per enabled
 * `Source` row (see src/lib/scrapers/generic.ts). Generic sources run last so a
 * slow or newly added site can't starve the established scrapers of the 300 s
 * Vercel budget.
 */
export async function getAllScrapers(): Promise<Scraper[]> {
  return [...scrapers, ...(await genericSourceScrapers())]
}

/**
 * The statically registered scrapers only (`?group=static`).
 */
export function getStaticScrapers(): Scraper[] {
  return [...scrapers]
}

export interface GenericScraperBatch {
  scrapers: Scraper[]
  /** How many enabled Sources exist in total, not just in this batch. */
  totalSources: number
  batch: number
  /** The batch size actually used; equals `totalSources` when unbatched. */
  batchSize: number
  hasMore: boolean
}

/**
 * The enabled generic sources as scrapers (`?group=generic`), optionally one
 * page at a time.
 *
 * Sources are ordered by name (see `enabledSources`), so `batch` is a stable
 * 0-based slice of that list and the daily workflow can walk it with
 * `hasMore`. A batch past the end returns no scrapers rather than an error, so
 * a workflow loop that overshoots ends quietly.
 */
export async function getGenericScrapers(
  options: { batch?: number; batchSize?: number } = {}
): Promise<GenericScraperBatch> {
  const page = takeBatch(await enabledSources(), options)

  return {
    scrapers: page.items.map(makeSourceScraper),
    totalSources: page.total,
    batch: page.batch,
    batchSize: page.batchSize,
    hasMore: page.hasMore,
  }
}

/**
 * Names of every available scraper, for the admin dropdown.
 */
export async function getScraperNames(): Promise<string[]> {
  return (await getAllScrapers()).map((s) => s.name)
}

/**
 * Result of running all scrapers
 */
export interface OrchestratorResult {
  results: ScraperResult[]
  totalEventsFound: number
  totalEventsAdded: number
  totalEventsUpdated: number
  totalEventsDuplicate: number
  /** Wall-clock time for the whole run, so the workflow log shows the trend. */
  totalDurationMs: number
}

/**
 * Run a set of scrapers and save their events to the database.
 *
 * Defaults to every scraper (static, then generic), which is what a bare
 * `POST /api/scrape` still does. The daily workflow instead passes one group at
 * a time — `getStaticScrapers()`, then pages of `getGenericScrapers()` — so no
 * single Vercel invocation has to fit the whole run into 300 s.
 *
 * Each scraper gets its own wall-clock budget (`Scraper.timeoutMs`, else
 * `DEFAULT_SCRAPER_TIMEOUT_MS`). Blowing it is recorded as an ordinary error
 * row in ScraperLog — so /admin/pulse shows it — and the run moves on.
 */
export async function runAllScrapers(
  scrapersToRun?: Scraper[],
  options: { groupLabel?: string } = {}
): Promise<OrchestratorResult> {
  const results: ScraperResult[] = []
  let totalEventsFound = 0
  let totalEventsAdded = 0
  let totalEventsUpdated = 0
  let totalEventsDuplicate = 0
  const runStartedAt = Date.now()

  const queue = scrapersToRun ?? (await getAllScrapers())

  for (const scraper of queue) {
    const timeoutMs = scraper.timeoutMs ?? DEFAULT_SCRAPER_TIMEOUT_MS
    console.log(`Running scraper: ${scraper.name} (budget ${Math.round(timeoutMs / 1000)}s)`)
    const startedAt = Date.now()

    try {
      const result = await withTimeout(scraper.scrape(), timeoutMs)
      const durationMs = Date.now() - startedAt
      result.durationMs = durationMs
      results.push(result)
      totalEventsFound += result.events.length

      console.log(`  Found ${result.events.length} events (${result.status}) in ${durationMs}ms`)

      // AI-categorize the events that are new to us, in one batched call
      await categorizeScrapedEvents(result.events, scraper.name)

      // Save events to database
      let scraperEventsAdded = 0
      for (const event of result.events) {
        const saveResult = await saveEvent(event)
        if (saveResult === 'added') { totalEventsAdded++; scraperEventsAdded++ }
        else if (saveResult === 'updated') totalEventsUpdated++
        else if (saveResult === 'duplicate') totalEventsDuplicate++
      }

      // Log the scraper run with the per-scraper added count
      await logScraperRun(
        scraper.name,
        result.status,
        result.eventsFound ?? result.events.length,
        scraperEventsAdded,
        result.errorMessage
      )
    } catch (error) {
      const durationMs = Date.now() - startedAt
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`  Error running ${scraper.name} after ${durationMs}ms:`, errorMessage)

      results.push({
        sourceName: scraper.name,
        events: [],
        status: 'error',
        errorMessage,
        durationMs,
      })

      await logScraperRun(scraper.name, 'error', 0, 0, errorMessage)
    }
  }

  const totalDurationMs = Date.now() - runStartedAt

  console.log(`\nScraping complete${options.groupLabel ? ` (${options.groupLabel})` : ''}:`)
  console.log(`  Total found: ${totalEventsFound}`)
  console.log(`  Added: ${totalEventsAdded}`)
  console.log(`  Updated: ${totalEventsUpdated}`)
  console.log(`  Duplicates: ${totalEventsDuplicate}`)
  console.log(`  Duration: ${totalDurationMs}ms`)

  // Send notification with summary
  const failedScrapers = results
    .filter((r) => r.status === 'error')
    .map((r) => r.sourceName)

  await notifyScraperComplete({
    totalEventsFound,
    totalEventsAdded,
    totalEventsUpdated,
    failedScrapers,
    group: options.groupLabel,
  })

  return {
    results,
    totalEventsFound,
    totalEventsAdded,
    totalEventsUpdated,
    totalEventsDuplicate,
    totalDurationMs,
  }
}

/**
 * Run a single scraper by name
 */
export async function runScraper(name: string): Promise<ScraperResult | null> {
  const available = await getAllScrapers()
  const scraper = available.find((s) => s.name.toLowerCase() === name.toLowerCase())

  if (!scraper) {
    console.error(`Scraper not found: ${name}`)
    return null
  }

  const timeoutMs = scraper.timeoutMs ?? DEFAULT_SCRAPER_TIMEOUT_MS
  console.log(`Running scraper: ${scraper.name} (budget ${Math.round(timeoutMs / 1000)}s)`)
  const startedAt = Date.now()

  let result: ScraperResult
  try {
    result = await withTimeout(scraper.scrape(), timeoutMs)
  } catch (error) {
    const durationMs = Date.now() - startedAt
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`  Error running ${scraper.name} after ${durationMs}ms:`, message)
    await logScraperRun(scraper.name, 'error', 0, 0, message)
    return {
      sourceName: scraper.name,
      events: [],
      status: 'error',
      errorMessage: message,
      durationMs,
    }
  }

  result.durationMs = Date.now() - startedAt
  console.log(`  Found ${result.events.length} events (${result.status}) in ${result.durationMs}ms`)

  // AI-categorize the events that are new to us, in one batched call
  await categorizeScrapedEvents(result.events, scraper.name)

  // Save events to database
  let added = 0
  for (const event of result.events) {
    const saveResult = await saveEvent(event)
    if (saveResult === 'added') added++
  }

  // Log the scraper run
  await logScraperRun(
    scraper.name,
    result.status,
    result.eventsFound ?? result.events.length,
    added,
    result.errorMessage
  )

  return result
}

type SaveResult = 'added' | 'updated' | 'duplicate' | 'error'

/**
 * Save a scraped event to the database with deduplication
 */
async function saveEvent(event: ScrapedEvent): Promise<SaveResult> {
  try {
    // Generate hash for deduplication
    const sourceHash = generateEventHash(event.title, event.venue, event.startDate)

    // Check if event already exists by hash
    const existing = await prisma.event.findUnique({
      where: { sourceHash },
    })

    if (existing) {
      // Update if from same source (allows refreshing data)
      if (existing.sourceName === event.sourceName) {
        await prisma.event.update({
          where: { sourceHash },
          data: {
            title: event.title,
            description: event.description,
            endDate: event.endDate,
            address: event.address,
            price: event.price,
            isFree: event.isFree,
            isFamilyFriendly: event.isFamilyFriendly,
            imageUrl: event.imageUrl,
            sourceUrl: event.sourceUrl,
          },
        })
        return 'updated'
      }
      // Different source, skip (keep first source)
      return 'duplicate'
    }

    // Also check for fuzzy duplicates on the same day
    const startOfDay = new Date(event.startDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(event.startDate)
    endOfDay.setHours(23, 59, 59, 999)

    const eventsOnSameDay = await prisma.event.findMany({
      where: {
        startDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    })

    // Check if any existing event is a fuzzy duplicate
    const fuzzyDuplicate = eventsOnSameDay.find(existing =>
      areEventsDuplicates(
        event.title,
        event.venue,
        event.startDate,
        existing.title,
        existing.venue,
        existing.startDate
      )
    )

    if (fuzzyDuplicate) {
      // Update if from same source
      if (fuzzyDuplicate.sourceName === event.sourceName) {
        await prisma.event.update({
          where: { id: fuzzyDuplicate.id },
          data: {
            title: event.title,
            description: event.description,
            endDate: event.endDate,
            address: event.address,
            price: event.price,
            isFree: event.isFree,
            isFamilyFriendly: event.isFamilyFriendly,
            imageUrl: event.imageUrl,
            sourceUrl: event.sourceUrl,
            sourceHash, // Update hash to new one
          },
        })
        return 'updated'
      }
      // Different source, skip (keep first source)
      return 'duplicate'
    }

    // Create new event
    await prisma.event.create({
      data: {
        title: event.title,
        description: event.description,
        startDate: event.startDate,
        endDate: event.endDate,
        venue: event.venue,
        address: event.address,
        city: event.city,
        isNyackProper: event.isNyackProper,
        category: event.category,
        price: event.price,
        isFree: event.isFree,
        isFamilyFriendly: event.isFamilyFriendly,
        sourceUrl: event.sourceUrl,
        sourceName: event.sourceName,
        imageUrl: event.imageUrl,
        sourceHash,
      },
    })

    return 'added'
  } catch (error) {
    console.error('Error saving event:', error)
    return 'error'
  }
}

/**
 * Log a scraper run to the database
 */
async function logScraperRun(
  sourceName: string,
  status: string,
  eventsFound: number,
  eventsAdded: number,
  errorMessage?: string
): Promise<void> {
  try {
    await prisma.scraperLog.create({
      data: {
        sourceName,
        status,
        eventsFound,
        eventsAdded,
        errorMessage,
      },
    })
  } catch (error) {
    console.error('Error logging scraper run:', error)
  }
}

/**
 * Clean up old events (past events older than 7 days)
 */
export async function cleanupOldEvents(): Promise<number> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const result = await prisma.event.deleteMany({
    where: {
      startDate: {
        lt: sevenDaysAgo,
      },
    },
  })

  console.log(`Cleaned up ${result.count} old events`)
  return result.count
}

