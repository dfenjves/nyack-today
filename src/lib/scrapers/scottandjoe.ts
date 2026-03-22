import { Scraper, ScraperResult, ScrapedEvent } from './types'
import { fetchWithTimeout, parsePrice, guessFamilyFriendly, stripHtml, decodeHtmlEntities } from './utils'
import { guessCategory } from '@/lib/utils/categories'

const SOURCE_NAME = 'Scott & Joe'
const SOURCE_URL = 'https://www.scottandjoe.co/classes-events'
const EVENTS_JSON_URL = 'https://www.scottandjoe.co/classes-events?format=json'
const VENUE = 'Scott & Joe'
const ADDRESS = '4 South Broadway'
const CITY = 'Nyack'

interface SquarespaceEventItem {
  id?: string
  title?: string
  fullUrl?: string
  startDate?: number | string
  endDate?: number | string
  body?: string
  assetUrl?: string
  location?: string
  excerpt?: string
  // Squarespace sometimes nests date info here
  dates?: {
    start?: number
    end?: number
  }
}

interface SquarespaceEventsResponse {
  items?: SquarespaceEventItem[]
  pagination?: {
    nextPage?: string
    hasNextPage?: boolean
  }
}

/**
 * Parse a Squarespace date value (Unix ms timestamp or ISO string) into a Date
 */
function parseSquarespaceDate(value: number | string | undefined): Date | null {
  if (!value) return null
  if (typeof value === 'number') {
    return new Date(value)
  }
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Fetch all pages of events from the Squarespace JSON API
 */
async function fetchAllEvents(): Promise<SquarespaceEventItem[]> {
  const allItems: SquarespaceEventItem[] = []
  let nextUrl: string | null = EVENTS_JSON_URL

  while (nextUrl) {
    const response = await fetchWithTimeout(nextUrl, 15000)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data: SquarespaceEventsResponse = await response.json()
    const items = data.items || []
    allItems.push(...items)

    nextUrl =
      data.pagination?.hasNextPage && data.pagination.nextPage
        ? data.pagination.nextPage.startsWith('http')
          ? data.pagination.nextPage
          : `https://www.scottandjoe.co${data.pagination.nextPage}`
        : null
  }

  return allItems
}

/**
 * Scraper for Scott & Joe cheese shop / wine bistro events in Nyack
 * Uses Squarespace JSON API (?format=json)
 */
export const scottAndJoeScraper: Scraper = {
  name: SOURCE_NAME,

  async scrape(): Promise<ScraperResult> {
    const events: ScrapedEvent[] = []

    try {
      const items = await fetchAllEvents()

      if (items.length === 0) {
        return {
          sourceName: SOURCE_NAME,
          events: [],
          status: 'partial',
          errorMessage: 'No upcoming events found',
        }
      }

      const now = new Date()

      for (const item of items) {
        if (!item.title) continue

        // Squarespace stores event dates either as top-level startDate or nested in dates
        const startDate =
          parseSquarespaceDate(item.startDate) ??
          parseSquarespaceDate(item.dates?.start)

        if (!startDate) {
          console.log(`[${SOURCE_NAME}] No start date for "${item.title}"`)
          continue
        }

        if (startDate < now) continue

        const endDate =
          parseSquarespaceDate(item.endDate) ??
          parseSquarespaceDate(item.dates?.end) ??
          null

        // Build description from body HTML
        let description: string | null = null
        if (item.body) {
          description = decodeHtmlEntities(stripHtml(item.body)).replace(/\s+/g, ' ').trim() || null
        } else if (item.excerpt) {
          description = decodeHtmlEntities(stripHtml(item.excerpt)).replace(/\s+/g, ' ').trim() || null
        }

        // Squarespace price sometimes appears in description
        const priceMatch = description?.match(/\$[\d,.]+/)
        const { price, isFree } = priceMatch
          ? parsePrice(priceMatch[0])
          : parsePrice(null)

        const eventUrl = item.fullUrl
          ? item.fullUrl.startsWith('http')
            ? item.fullUrl
            : `https://www.scottandjoe.co${item.fullUrl}`
          : SOURCE_URL

        const event: ScrapedEvent = {
          title: item.title.trim(),
          description,
          startDate,
          endDate,
          venue: VENUE,
          address: ADDRESS,
          city: CITY,
          isNyackProper: true,
          category: guessCategory(item.title, description),
          price,
          isFree,
          isFamilyFriendly: guessFamilyFriendly(item.title, description),
          sourceUrl: eventUrl,
          sourceName: SOURCE_NAME,
          imageUrl: item.assetUrl || null,
        }

        events.push(event)
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
