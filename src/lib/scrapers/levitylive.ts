import * as cheerio from 'cheerio'
import { Category } from '@prisma/client'
import { Scraper, ScraperResult, ScrapedEvent } from './types'
import {
  fetchWithTimeout,
  parsePrice,
  guessFamilyFriendly,
  decodeHtmlEntities,
  stripHtml,
} from './utils'

const SOURCE_NAME = 'Levity Live'
const SOURCE_URL = 'https://www.levitylive.com/nyack'
const VENUE_NAME = 'Levity Live'
const CITY = 'West Nyack'
const ADDRESS = '4210 Palisades Center Dr, West Nyack, NY 10994'

/**
 * Scraper for Levity Live comedy club
 * Uses JSON-LD structured data with @graph array format
 */
export const levityLiveScraper: Scraper = {
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

      // Extract JSON-LD events - Levity Live uses @graph array format
      $('script[type="application/ld+json"]').each((_, element) => {
        try {
          const content = $(element).html()
          if (!content) return

          const data = JSON.parse(content)

          // Handle @graph array format
          if (data['@graph'] && Array.isArray(data['@graph'])) {
            for (const item of data['@graph']) {
              if (item['@type'] === 'Event') {
                const scraped = convertLevityEvent(item)
                if (scraped) {
                  events.push(scraped)
                }
              }
            }
          }
          // Also handle direct Event type
          else if (data['@type'] === 'Event') {
            const scraped = convertLevityEvent(data)
            if (scraped) {
              events.push(scraped)
            }
          }
          // Handle array of events
          else if (Array.isArray(data)) {
            for (const item of data) {
              if (item['@type'] === 'Event') {
                const scraped = convertLevityEvent(item)
                if (scraped) {
                  events.push(scraped)
                }
              }
            }
          }
        } catch {
          // Ignore JSON parse errors for individual scripts
        }
      })

      if (events.length === 0) {
        return {
          sourceName: SOURCE_NAME,
          events: [],
          status: 'partial',
          errorMessage: 'No JSON-LD events found on page',
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

interface LevityJsonLdEvent {
  '@type': string
  name?: string
  description?: string
  startDate?: string
  endDate?: string
  url?: string
  image?: string | string[]
  location?: {
    '@type': string
    name?: string
    address?: {
      '@type': string
      streetAddress?: string
      addressLocality?: string
      addressRegion?: string
      postalCode?: string
    } | string
  }
  offers?: {
    '@type': string
    price?: string | number
    priceCurrency?: string
    url?: string
    availability?: string
  } | Array<{
    '@type': string
    price?: string | number
    priceCurrency?: string
    url?: string
    availability?: string
  }>
  performer?: {
    '@type': string
    name?: string
  } | Array<{
    '@type': string
    name?: string
  }>
}

/**
 * Convert a Levity Live JSON-LD event to our ScrapedEvent format
 */
function convertLevityEvent(jsonLd: LevityJsonLdEvent): ScrapedEvent | null {
  try {
    // Required fields
    if (!jsonLd.name || !jsonLd.startDate) {
      return null
    }

    // Parse start date
    const startDate = new Date(jsonLd.startDate)
    if (isNaN(startDate.getTime())) {
      return null
    }

    // Skip past events
    if (startDate < new Date()) {
      return null
    }

    // Parse end date
    let endDate: Date | null = null
    if (jsonLd.endDate) {
      endDate = new Date(jsonLd.endDate)
      if (isNaN(endDate.getTime())) {
        endDate = null
      }
    }

    // Parse price
    let priceData: string | number | undefined
    if (jsonLd.offers) {
      const offer = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers
      priceData = offer?.price
    }
    const { price, isFree } = parsePrice(priceData)

    // Get description - clean HTML entities and strip tags
    let description = jsonLd.description || null
    if (description) {
      description = decodeHtmlEntities(stripHtml(description)).trim()
    }

    // Clean title of HTML entities
    const title = decodeHtmlEntities(jsonLd.name).trim()

    // Get image URL
    let imageUrl: string | null = null
    if (jsonLd.image) {
      imageUrl = Array.isArray(jsonLd.image) ? jsonLd.image[0] : jsonLd.image
    }

    // Get event URL
    const eventUrl = jsonLd.url || SOURCE_URL

    return {
      title,
      description,
      startDate,
      endDate,
      venue: VENUE_NAME,
      address: ADDRESS,
      city: CITY,
      isNyackProper: false, // West Nyack is not Nyack proper
      category: Category.COMEDY, // All Levity Live events are comedy
      price,
      isFree,
      isFamilyFriendly: guessFamilyFriendly(title, description),
      sourceUrl: eventUrl,
      sourceName: SOURCE_NAME,
      imageUrl,
    }
  } catch {
    return null
  }
}
