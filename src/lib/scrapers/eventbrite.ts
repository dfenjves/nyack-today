import * as cheerio from 'cheerio'
import { Scraper, ScraperResult, ScrapedEvent } from './types'
import { fetchWithTimeout, isInCoverageArea, isNyackProper, parsePrice, guessFamilyFriendly } from './utils'
import { guessCategory } from '@/lib/utils/categories'

const SOURCE_NAME = 'Eventbrite'
const SEARCH_URL = 'https://www.eventbrite.com/d/ny--nyack/events/'

interface EventbriteJsonLdItem {
  '@type': string
  position: number
  name: string
  startDate: string
  endDate?: string
  url: string
  image?: string
  location?: {
    '@type': string
    name?: string
    address?: {
      '@type': string
      streetAddress?: string
      addressLocality?: string
      addressRegion?: string
      postalCode?: string
    }
  }
  offers?: {
    '@type': string
    price?: number | string
    priceCurrency?: string
  }
  description?: string
}

interface EventbriteJsonLd {
  '@context': string
  '@type': string
  itemListElement?: EventbriteJsonLdItem[]
}

/**
 * Scraper for Eventbrite Nyack-area events
 * Scrapes the search results page which contains JSON-LD ItemList
 */
export const eventbriteScraper: Scraper = {
  name: SOURCE_NAME,

  async scrape(): Promise<ScraperResult> {
    const events: ScrapedEvent[] = []

    try {
      // Fetch the search results page
      const response = await fetchWithTimeout(SEARCH_URL, 15000)

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

      // Look for JSON-LD with ItemList
      const jsonLdData = findItemListJsonLd($)

      if (!jsonLdData?.itemListElement) {
        return {
          sourceName: SOURCE_NAME,
          events: [],
          status: 'partial',
          errorMessage: 'No ItemList JSON-LD found on page',
        }
      }

      // Convert each event item
      for (const item of jsonLdData.itemListElement) {
        const scraped = convertEventbriteItem(item)
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

function findItemListJsonLd($: cheerio.CheerioAPI): EventbriteJsonLd | null {
  let result: EventbriteJsonLd | null = null

  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const content = $(element).html()
      if (!content) return

      const data = JSON.parse(content)
      if (data['@type'] === 'ItemList' && data.itemListElement) {
        result = data as EventbriteJsonLd
      }
    } catch {
      // Ignore parse errors
    }
  })

  return result
}

function convertEventbriteItem(item: EventbriteJsonLdItem): ScrapedEvent | null {
  try {
    // Skip non-event items
    if (item['@type'] !== 'Event') {
      return null
    }

    // Required fields
    if (!item.name || !item.startDate || !item.url) {
      return null
    }

    // Parse start date
    const startDate = new Date(item.startDate)
    if (isNaN(startDate.getTime())) {
      return null
    }

    // Skip past events
    if (startDate < new Date()) {
      return null
    }

    // Parse end date
    let endDate: Date | null = null
    if (item.endDate) {
      endDate = new Date(item.endDate)
      if (isNaN(endDate.getTime())) {
        endDate = null
      }
    }

    // Extract venue and location
    const venue = item.location?.name || 'See event details'
    const address = item.location?.address?.streetAddress || null
    const city = item.location?.address?.addressLocality || 'Nyack'

    // Filter to coverage area
    if (!isInCoverageArea(city)) {
      return null
    }

    // Parse price
    const { price, isFree } = parsePrice(item.offers?.price)

    // Get description if available
    const description = item.description || null

    return {
      title: item.name.trim(),
      description,
      startDate,
      endDate,
      venue,
      address,
      city,
      isNyackProper: isNyackProper(city),
      category: guessCategory(item.name, description),
      price,
      isFree,
      isFamilyFriendly: guessFamilyFriendly(item.name, description),
      sourceUrl: item.url,
      sourceName: SOURCE_NAME,
      imageUrl: item.image || null,
    }
  } catch {
    return null
  }
}
