import * as cheerio from 'cheerio'
import { Scraper, ScraperResult, ScrapedEvent } from './types'
import {
  fetchWithTimeout,
  parsePrice,
  guessFamilyFriendly,
  stripHtml,
  decodeHtmlEntities,
  isNyackProper,
} from './utils'
import { guessCategory } from '@/lib/utils/categories'

const SOURCE_NAME = 'Patch Nyack'
const SOURCE_URL = 'https://patch.com/new-york/nyack/calendar'
const BASE_URL = 'https://patch.com'

// Only include events in Nyack and immediately adjacent villages
const NYACK_CITIES = ['nyack', 'south nyack', 'upper nyack', 'west nyack']

interface PatchAddress {
  name?: string
  streetAddress?: string
  city?: string
  region?: string
  postalCode?: string
}

interface PatchEvent {
  id?: string
  title?: string
  displayDate?: string
  address?: PatchAddress
  body?: string
  summary?: string
  eventType?: string
  ogImageUrl?: string
  imageThumbnail?: string
  eventSiteUrl?: string
  canonicalUrl?: string
}

/**
 * Scraper for Patch.com Nyack events calendar
 * Extracts event data from Next.js __NEXT_DATA__ JSON embedded in the page
 */
export const patchScraper: Scraper = {
  name: SOURCE_NAME,

  async scrape(): Promise<ScraperResult> {
    const events: ScrapedEvent[] = []

    try {
      const response = await fetchWithTimeout(SOURCE_URL, 15000)

      if (!response.ok) {
        return {
          sourceName: SOURCE_NAME,
          events: [],
          status: 'error',
          errorMessage: `HTTP ${response.status}: ${response.statusText}`,
        }
      }

      const html = await response.text()
      const $ = cheerio.load(html)

      // Extract __NEXT_DATA__ JSON embedded by Next.js
      const nextDataScript = $('#__NEXT_DATA__').html()
      if (!nextDataScript) {
        return {
          sourceName: SOURCE_NAME,
          events: [],
          status: 'error',
          errorMessage: 'Could not find __NEXT_DATA__ script tag',
        }
      }

      let nextData: Record<string, unknown>
      try {
        nextData = JSON.parse(nextDataScript)
      } catch {
        return {
          sourceName: SOURCE_NAME,
          events: [],
          status: 'error',
          errorMessage: 'Failed to parse __NEXT_DATA__ JSON',
        }
      }

      // Navigate to allEvents: props.pageProps.mainContent.allEvents
      // allEvents is an object keyed by UNIX timestamps, each value is an array of events
      const mainContent = (
        (nextData?.props as Record<string, unknown>)?.pageProps as Record<string, unknown>
      )?.mainContent as Record<string, unknown>

      const allEventsObj = mainContent?.allEvents as Record<string, PatchEvent[]> | undefined

      if (!allEventsObj || typeof allEventsObj !== 'object') {
        return {
          sourceName: SOURCE_NAME,
          events: [],
          status: 'partial',
          errorMessage: 'No events found in page data',
        }
      }

      // Flatten all date-keyed arrays into a single list
      const eventList: PatchEvent[] = Object.values(allEventsObj).flat()

      const now = new Date()

      for (const event of eventList) {
        if (!event.title || !event.displayDate) continue

        // Filter: only Nyack-area cities
        const city = event.address?.city?.trim() || ''
        if (!city || !NYACK_CITIES.includes(city.toLowerCase())) continue

        // Parse date
        const startDate = new Date(event.displayDate)
        if (isNaN(startDate.getTime())) continue
        if (startDate < now) continue

        // Build source URL
        const sourceUrl = event.canonicalUrl
          ? `${BASE_URL}${event.canonicalUrl}`
          : event.eventSiteUrl || SOURCE_URL

        // Clean description
        let description: string | null = null
        if (event.body) {
          description = decodeHtmlEntities(stripHtml(event.body)).trim() || null
        } else if (event.summary) {
          description = decodeHtmlEntities(event.summary).trim() || null
        }

        // Venue name from address.name, fallback to city
        const venue = event.address?.name?.trim() || city

        // Address
        const address = event.address?.streetAddress
          ? `${event.address.streetAddress}, ${city}, ${event.address.region || 'NY'} ${event.address.postalCode || ''}`.trim()
          : null

        // Price - Patch uses eventType field ("free" etc.)
        const { price, isFree } = event.eventType === 'free'
          ? { price: null, isFree: true }
          : parsePrice(event.eventType)

        // Prefer thumbnail, fall back to ogImageUrl; skip generic placeholders
        let imageUrl: string | null = event.imageThumbnail || event.ogImageUrl || null
        if (imageUrl?.includes('/assets/calendar/events')) {
          imageUrl = null
        }

        const scrapedEvent: ScrapedEvent = {
          title: decodeHtmlEntities(event.title).trim(),
          description,
          startDate,
          endDate: null,
          venue,
          address,
          city,
          isNyackProper: isNyackProper(city),
          category: guessCategory(event.title, description),
          price,
          isFree,
          isFamilyFriendly: guessFamilyFriendly(event.title, description),
          sourceUrl,
          sourceName: SOURCE_NAME,
          imageUrl,
        }

        events.push(scrapedEvent)
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
