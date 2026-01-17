import { Scraper, ScraperResult, ScrapedEvent } from './types'
import { extractJsonLdEvents, jsonLdToScrapedEvent, fetchWithTimeout } from './utils'

const SOURCE_NAME = 'The Angel Nyack'
const EVENTS_URL = 'https://theangelnyack.com/events/'

/**
 * Scraper for theangelnyack.com events
 * Uses The Events Calendar plugin which outputs JSON-LD structured data
 */
export const theAngelNyackScraper: Scraper = {
  name: SOURCE_NAME,

  async scrape(): Promise<ScraperResult> {
    const events: ScrapedEvent[] = []

    try {
      // Fetch the events page
      const response = await fetchWithTimeout(EVENTS_URL)

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
        const scraped = jsonLdToScrapedEvent(jsonLd, SOURCE_NAME, EVENTS_URL)
        if (scraped) {
          events.push(scraped)
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
