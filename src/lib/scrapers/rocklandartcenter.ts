import * as cheerio from 'cheerio'
import { Scraper, ScraperResult, ScrapedEvent } from './types'
import { fetchWithTimeout, parsePrice, guessFamilyFriendly, decodeHtmlEntities, stripHtml, makeEasternDate } from './utils'
import { guessCategory } from '@/lib/utils/categories'

const SOURCE_NAME = 'Rockland Center for the Arts'
const LISTING_URL = 'https://rocklandartcenter.org/all-events/upcoming-events.html'
const VENUE = 'Rockland Center for the Arts'
const ADDRESS = '27 South Greenbush Road'
const CITY = 'West Nyack'

const MONTH_MAP: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
}

/**
 * Parse a date string like "Saturday, May 2 at 7:30pm" or "Sunday, April 19 at 1:00pm"
 * Returns a Date object or null if parsing fails.
 */
function parseEventDate(dateText: string): Date | null {
  // Match "Month Day at H:MMam/pm" or "Month Day at H:MMam/pm - H:MMam/pm"
  const match = dateText.match(
    /(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(\w+)\s+(\d+)\s+at\s+(\d+):(\d+)\s*(am|pm)/i
  )
  if (!match) return null

  const [, monthStr, dayStr, hourStr, minuteStr, ampm] = match
  const monthIndex = MONTH_MAP[monthStr.toLowerCase()]
  if (monthIndex === undefined) return null

  let hour = parseInt(hourStr, 10)
  const minute = parseInt(minuteStr, 10)
  const day = parseInt(dayStr, 10)

  if (ampm.toLowerCase() === 'pm' && hour !== 12) hour += 12
  if (ampm.toLowerCase() === 'am' && hour === 12) hour = 0

  // Determine year: if the month/day is in the past for current year, use next year
  const now = new Date()
  let year = now.getFullYear()
  const candidate = new Date(year, monthIndex, day, hour, minute)
  if (candidate < now) {
    year += 1
  }

  return makeEasternDate(year, monthIndex, day, hour, minute)
}

/**
 * Extract event URLs from the listing page
 */
function extractEventUrls(html: string): string[] {
  const $ = cheerio.load(html)
  const urls: string[] = []

  $('.product-item a.product-item-link, .product-item .product-item-name a').each((_, el) => {
    const href = $(el).attr('href')
    if (href && !urls.includes(href)) {
      urls.push(href)
    }
  })

  // Fallback: any product link on the page
  if (urls.length === 0) {
    $('a[href*="rocklandartcenter.org"]').each((_, el) => {
      const href = $(el).attr('href') || ''
      if (
        href.includes('rocklandartcenter.org') &&
        !href.includes('all-events') &&
        href.endsWith('.html') &&
        !urls.includes(href)
      ) {
        urls.push(href)
      }
    })
  }

  return urls
}

/**
 * Extract event details from an individual event page
 */
function extractEventDetails(html: string, url: string): {
  title: string
  description: string | null
  dateText: string | null
  priceText: string | null
  imageUrl: string | null
} | null {
  const $ = cheerio.load(html)

  // Title
  const title = $('h1.page-title span, h1.product-name').first().text().trim()
    || $('h1').first().text().trim()
  if (!title) return null

  // Description: look for short description or full description block
  const descEl = $('.product.attribute.description .value, .product-info-main .product.attribute .value, #description .value')
  let description: string | null = descEl.first().html() || null
  if (description) {
    description = decodeHtmlEntities(stripHtml(description)).replace(/\s+/g, ' ').trim()
    if (!description) description = null
  }

  // Date: scan all text on page for date pattern
  let dateText: string | null = null
  const bodyText = $('body').text()
  const dateMatch = bodyText.match(
    /(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+\w+\s+\d+\s+at\s+\d+:\d+\s*(?:am|pm)/i
  )
  if (dateMatch) {
    dateText = dateMatch[0]
  }

  // Price
  const priceText = $('.price-box .price').first().text().trim() || null

  // Image
  const imageUrl = $('meta[property="og:image"]').attr('content')
    || $('.product.media img.gallery-placeholder__image').first().attr('src')
    || null

  return { title, description, dateText, priceText, imageUrl }
}

/**
 * Scraper for Rockland Center for the Arts events
 * Uses Cheerio (server-rendered Magento pages)
 */
export const rocklandArtCenterScraper: Scraper = {
  name: SOURCE_NAME,

  async scrape(): Promise<ScraperResult> {
    const events: ScrapedEvent[] = []

    try {
      // Fetch listing page
      const listingResponse = await fetchWithTimeout(LISTING_URL, 15000)
      if (!listingResponse.ok) {
        return {
          sourceName: SOURCE_NAME,
          events: [],
          status: 'error',
          errorMessage: `HTTP ${listingResponse.status}: ${listingResponse.statusText}`,
        }
      }

      const listingHtml = await listingResponse.text()
      const eventUrls = extractEventUrls(listingHtml)

      if (eventUrls.length === 0) {
        return {
          sourceName: SOURCE_NAME,
          events: [],
          status: 'partial',
          errorMessage: 'No event URLs found on listing page',
        }
      }

      console.log(`[${SOURCE_NAME}] Found ${eventUrls.length} event URLs`)

      for (const url of eventUrls) {
        try {
          const eventResponse = await fetchWithTimeout(url, 10000)
          if (!eventResponse.ok) {
            console.log(`[${SOURCE_NAME}] Failed to fetch ${url}: ${eventResponse.status}`)
            continue
          }

          const eventHtml = await eventResponse.text()
          const details = extractEventDetails(eventHtml, url)

          if (!details) {
            console.log(`[${SOURCE_NAME}] Could not extract details from ${url}`)
            continue
          }

          if (!details.dateText) {
            console.log(`[${SOURCE_NAME}] No date found for ${details.title}`)
            continue
          }

          const startDate = parseEventDate(details.dateText)
          if (!startDate) {
            console.log(`[${SOURCE_NAME}] Could not parse date "${details.dateText}" for ${details.title}`)
            continue
          }

          // Skip past events
          if (startDate < new Date()) {
            continue
          }

          const { price, isFree } = parsePrice(details.priceText)
          const category = guessCategory(details.title, details.description)
          const isFamilyFriendly = guessFamilyFriendly(details.title, details.description)

          const event: ScrapedEvent = {
            title: details.title,
            description: details.description,
            startDate,
            endDate: null,
            venue: VENUE,
            address: ADDRESS,
            city: CITY,
            isNyackProper: false,
            category,
            price,
            isFree,
            isFamilyFriendly,
            sourceUrl: url,
            sourceName: SOURCE_NAME,
            imageUrl: details.imageUrl || null,
          }

          events.push(event)

          // Polite delay between requests
          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (error) {
          console.log(`[${SOURCE_NAME}] Error processing ${url}:`, error)
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
