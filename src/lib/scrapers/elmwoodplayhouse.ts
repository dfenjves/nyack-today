import { Category } from '@prisma/client'
import { Scraper, ScraperResult, ScrapedEvent } from './types'
import {
  extractJsonLdEvents,
  jsonLdToScrapedEvent,
  fetchWithTimeout,
} from './utils'

const SOURCE_NAME = 'Elmwood Playhouse'
const SOURCE_URL = 'https://www.elmwoodplayhouse.com/'
const VENUE_NAME = 'Elmwood Playhouse'
const CITY = 'Nyack'
const ADDRESS = '10 Park Street, Nyack, NY 10960'

/**
 * Scraper for Elmwood Playhouse theater
 * Uses Modern Events Calendar plugin with JSON-LD structured data
 */
export const elmwoodPlayhouseScraper: Scraper = {
  name: SOURCE_NAME,

  async scrape(): Promise<ScraperResult> {
    const events: ScrapedEvent[] = []

    try {
      const response = await fetchWithTimeout(SOURCE_URL)

      if (!response.ok) {
        return {
          sourceName: SOURCE_NAME,
          events: [],
          status: 'error',
          errorMessage: `HTTP ${response.status}: ${response.statusText}`,
        }
      }

      const html = await response.text()

      // Extract JSON-LD events
      const jsonLdEvents = extractJsonLdEvents(html)

      if (jsonLdEvents.length === 0) {
        return {
          sourceName: SOURCE_NAME,
          events: [],
          status: 'partial',
          errorMessage: 'No JSON-LD events found on page',
        }
      }

      // Convert each JSON-LD event to our format
      for (const jsonLd of jsonLdEvents) {
        const scraped = jsonLdToScrapedEvent(jsonLd, SOURCE_NAME, SOURCE_URL)
        if (scraped) {
          // Override with theater-specific values
          const theaterEvent: ScrapedEvent = {
            ...scraped,
            venue: VENUE_NAME,
            address: ADDRESS,
            city: CITY,
            isNyackProper: true, // Nyack is Nyack proper
            category: Category.THEATER, // All Elmwood events are theater
          }
          events.push(theaterEvent)
        }
      }

      return {
        sourceName: SOURCE_NAME,
        events,
        status: 'success',
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return {
        sourceName: SOURCE_NAME,
        events,
        status: events.length > 0 ? 'partial' : 'error',
        errorMessage: message,
      }
    }
  },
}
