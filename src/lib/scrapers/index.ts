import { prisma } from '@/lib/db'
import { Scraper, ScraperResult, ScrapedEvent } from './types'
import { generateEventHash } from './utils'
import { visitNyackScraper } from './visitnyack'
import { theAngelNyackScraper } from './theangelnyack'
import { eventbriteScraper } from './eventbrite'
import { levityLiveScraper } from './levitylive'
import { elmwoodPlayhouseScraper } from './elmwoodplayhouse'
import { rivertownFilmScraper } from './rivertownfilm'
import { notifyScraperComplete, notifyScraperError } from '@/lib/utils/notifications'

/**
 * All registered scrapers
 */
export const scrapers: Scraper[] = [
  visitNyackScraper,
  theAngelNyackScraper,
  eventbriteScraper,
  levityLiveScraper,
  elmwoodPlayhouseScraper,
  rivertownFilmScraper,
]

/**
 * Result of running all scrapers
 */
export interface OrchestratorResult {
  results: ScraperResult[]
  totalEventsFound: number
  totalEventsAdded: number
  totalEventsUpdated: number
  totalEventsDuplicate: number
}

/**
 * Run all scrapers and save events to database
 */
export async function runAllScrapers(): Promise<OrchestratorResult> {
  const results: ScraperResult[] = []
  let totalEventsFound = 0
  let totalEventsAdded = 0
  let totalEventsUpdated = 0
  let totalEventsDuplicate = 0

  // Run each scraper
  for (const scraper of scrapers) {
    console.log(`Running scraper: ${scraper.name}`)

    try {
      const result = await scraper.scrape()
      results.push(result)
      totalEventsFound += result.events.length

      console.log(`  Found ${result.events.length} events (${result.status})`)

      // Save events to database
      for (const event of result.events) {
        const saveResult = await saveEvent(event)
        if (saveResult === 'added') totalEventsAdded++
        else if (saveResult === 'updated') totalEventsUpdated++
        else if (saveResult === 'duplicate') totalEventsDuplicate++
      }

      // Log the scraper run
      await logScraperRun(
        scraper.name,
        result.status,
        result.events.length,
        totalEventsAdded,
        result.errorMessage
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`  Error running ${scraper.name}:`, errorMessage)

      results.push({
        sourceName: scraper.name,
        events: [],
        status: 'error',
        errorMessage,
      })

      await logScraperRun(scraper.name, 'error', 0, 0, errorMessage)
    }
  }

  console.log(`\nScraping complete:`)
  console.log(`  Total found: ${totalEventsFound}`)
  console.log(`  Added: ${totalEventsAdded}`)
  console.log(`  Updated: ${totalEventsUpdated}`)
  console.log(`  Duplicates: ${totalEventsDuplicate}`)

  // Send notification with summary
  const failedScrapers = results
    .filter((r) => r.status === 'error')
    .map((r) => r.sourceName)

  await notifyScraperComplete({
    totalEventsFound,
    totalEventsAdded,
    totalEventsUpdated,
    failedScrapers,
  })

  return {
    results,
    totalEventsFound,
    totalEventsAdded,
    totalEventsUpdated,
    totalEventsDuplicate,
  }
}

/**
 * Run a single scraper by name
 */
export async function runScraper(name: string): Promise<ScraperResult | null> {
  const scraper = scrapers.find((s) => s.name.toLowerCase() === name.toLowerCase())

  if (!scraper) {
    console.error(`Scraper not found: ${name}`)
    return null
  }

  console.log(`Running scraper: ${scraper.name}`)
  const result = await scraper.scrape()

  console.log(`  Found ${result.events.length} events (${result.status})`)

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
    result.events.length,
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

    // Check if event already exists
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

