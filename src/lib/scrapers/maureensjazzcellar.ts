import { Category } from '@prisma/client'
import { Scraper, ScraperResult, ScrapedEvent } from './types'
import {
  fetchWithTimeout,
  parsePrice,
  guessFamilyFriendly,
} from './utils'

const SOURCE_NAME = "Maureen's Jazz Cellar"
const SOURCE_URL = 'https://www.maureensjazzcellar.com/event-calendar.html'
const VENUE_NAME = "Maureen's Jazz Cellar"
const CITY = 'Nyack'
const ADDRESS = '46 Main St, Nyack, NY 10960'

// Inffuse calendar API endpoint
const API_URL = 'https://inffuse.eventscalendar.co/js/v0.1/calendar/data?inffuse-platform=weebly&inffuse-user=75555087&inffuse-site=265976362367589702&inffuse-project=d1a10f1c-037d-4f4a-b104-e0d85da09c41'

/**
 * Scraper for Maureen's Jazz Cellar
 * Uses Inffuse calendar API (JSON endpoint)
 */
export const maureensJazzCellarScraper: Scraper = {
  name: SOURCE_NAME,

  async scrape(): Promise<ScraperResult> {
    const events: ScrapedEvent[] = []

    try {
      const response = await fetchWithTimeout(API_URL, 15000)

      if (!response.ok) {
        return {
          sourceName: SOURCE_NAME,
          events: [],
          status: 'error',
          errorMessage: `HTTP ${response.status}: ${response.statusText}`,
        }
      }

      const data = await response.json()

      // Extract events from the API response
      const apiEvents = data?.project?.data?.events

      if (!Array.isArray(apiEvents)) {
        return {
          sourceName: SOURCE_NAME,
          events: [],
          status: 'error',
          errorMessage: 'Invalid API response format',
        }
      }

      for (const event of apiEvents) {
        const scrapedEvent = convertInffuseEvent(event)
        if (scrapedEvent) {
          events.push(scrapedEvent)
        }
      }

      if (events.length === 0) {
        return {
          sourceName: SOURCE_NAME,
          events: [],
          status: 'partial',
          errorMessage: 'No upcoming events found',
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

interface InffuseEvent {
  id: string
  title: string
  description?: string
  start: number // Unix timestamp in milliseconds
  end: number
  startDate: string // YYYY-MM-DD format
  endDate: string
  timezone: string
  allday: boolean
  dateonly: boolean
}

/**
 * Convert Inffuse API event to our ScrapedEvent format
 */
function convertInffuseEvent(event: InffuseEvent): ScrapedEvent | null {
  try {
    if (!event.title || !event.start) {
      return null
    }

    // Parse start date from Unix timestamp (milliseconds)
    const startDate = new Date(event.start)

    // Skip past events
    const now = new Date()
    if (startDate < now) {
      return null
    }

    // Parse end date
    let endDate: Date | null = null
    if (event.end) {
      endDate = new Date(event.end)
    }

    // Parse price from description
    const description = event.description || ''
    let price: string | null = null
    let isFree = false

    // Look for price patterns in description
    const priceMatch = description.match(/(?:MUSIC CHARGE|COVER CHARGE|CHARGE)[:\s-]*\$?([\d.]+)/i)
    if (priceMatch) {
      price = `$${priceMatch[1]}`
    } else if (description.match(/NO COVER/i)) {
      isFree = true
    }

    // Determine if event is family friendly
    const isFamilyFriendly = guessFamilyFriendly(event.title, description)

    return {
      title: event.title.trim(),
      description: description.trim() || null,
      startDate,
      endDate,
      venue: VENUE_NAME,
      address: ADDRESS,
      city: CITY,
      isNyackProper: true,
      category: Category.MUSIC, // All events at Maureen's are music/jazz
      price,
      isFree,
      isFamilyFriendly,
      sourceUrl: SOURCE_URL,
      sourceName: SOURCE_NAME,
      imageUrl: null,
    }
  } catch {
    return null
  }
}
