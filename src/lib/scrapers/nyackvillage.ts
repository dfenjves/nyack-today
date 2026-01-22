import * as cheerio from 'cheerio'
import { Category } from '@prisma/client'
import { Scraper, ScraperResult, ScrapedEvent } from './types'
import { fetchWithTimeout, decodeHtmlEntities, stripHtml } from './utils'

const SOURCE_NAME = 'Village of Nyack'
const CITY = 'Nyack'
const ADDRESS = '9 N Broadway, Nyack, NY 10960' // Village Hall

/**
 * RSS feed URLs for Nyack Village calendar
 */
const RSS_FEEDS = [
  {
    url: 'https://www.nyack.gov/rss/calendar/577/',
    name: 'Village Events',
  },
  {
    url: 'https://www.nyack.gov/rss/calendar/578/',
    name: 'Village Board of Trustees',
  },
]

/**
 * Scraper for Village of Nyack government calendar
 * Uses RSS feeds from nyack.gov
 */
export const nyackVillageScraper: Scraper = {
  name: SOURCE_NAME,

  async scrape(): Promise<ScraperResult> {
    const events: ScrapedEvent[] = []
    const errors: string[] = []

    for (const feed of RSS_FEEDS) {
      try {
        const response = await fetchWithTimeout(feed.url)

        if (!response.ok) {
          errors.push(`${feed.name}: HTTP ${response.status}`)
          continue
        }

        const xml = await response.text()
        const feedEvents = parseRssFeed(xml, feed.name)
        events.push(...feedEvents)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`${feed.name}: ${message}`)
      }
    }

    if (events.length === 0 && errors.length > 0) {
      return {
        sourceName: SOURCE_NAME,
        events: [],
        status: 'error',
        errorMessage: errors.join('; '),
      }
    }

    return {
      sourceName: SOURCE_NAME,
      events,
      status: errors.length > 0 ? 'partial' : 'success',
      errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
    }
  },
}

/**
 * Parse RSS feed XML and extract events
 */
function parseRssFeed(xml: string, feedName: string): ScrapedEvent[] {
  const events: ScrapedEvent[] = []
  const $ = cheerio.load(xml, { xmlMode: true })

  $('item').each((_, item) => {
    const $item = $(item)
    const event = parseRssItem($item, feedName)
    if (event) {
      events.push(event)
    }
  })

  return events
}

/**
 * Parse a single RSS item into a ScrapedEvent
 */
function parseRssItem(
  $item: ReturnType<cheerio.CheerioAPI>,
  feedName: string
): ScrapedEvent | null {
  try {
    // Extract title
    const title = $item.find('title').text().trim()
    if (!title) {
      return null
    }

    // Extract dates - RSS feed uses dates_times namespace
    const startDateStr = $item.find('dates_times\\:start_date, start_date').text().trim()
    const startTimeStr = $item.find('dates_times\\:start_time, start_time').text().trim()
    const endTimeStr = $item.find('dates_times\\:end_time, end_time').text().trim()

    if (!startDateStr) {
      return null
    }

    // Parse start date and time
    const startDate = parseDateTimeFromRss(startDateStr, startTimeStr)
    if (!startDate) {
      return null
    }

    // Skip past events
    if (startDate < new Date()) {
      return null
    }

    // Parse end date/time
    let endDate: Date | null = null
    if (endTimeStr) {
      endDate = parseDateTimeFromRss(startDateStr, endTimeStr)
    }

    // Extract description
    let description = $item.find('description').text().trim()
    if (description) {
      description = decodeHtmlEntities(stripHtml(description)).trim()
      if (description.length > 500) {
        description = description.substring(0, 497) + '...'
      }
    }

    // Extract link
    const sourceUrl = $item.find('link').text().trim() || 'https://www.nyack.gov/calendar'

    // Determine venue based on event type
    let venue = 'Village of Nyack'
    let address = ADDRESS

    // Street fairs happen on Main Street
    if (title.toLowerCase().includes('street fair')) {
      venue = 'Main Street'
      address = 'Main Street, Nyack, NY 10960'
    }
    // Halloween parade
    else if (title.toLowerCase().includes('halloween') || title.toLowerCase().includes('parade')) {
      venue = 'Downtown Nyack'
      address = 'Main Street, Nyack, NY 10960'
    }
    // Board meetings at Village Hall
    else if (
      title.toLowerCase().includes('board') ||
      title.toLowerCase().includes('trustees') ||
      title.toLowerCase().includes('meeting')
    ) {
      venue = 'Nyack Village Hall'
    }
    // Penguin Plunge at Memorial Park
    else if (title.toLowerCase().includes('penguin') || title.toLowerCase().includes('plunge')) {
      venue = 'Memorial Park Beach'
      address = 'Memorial Park, Nyack, NY 10960'
    }

    // Skip holiday closures (not really events people attend)
    if (
      title.toLowerCase().includes('closed') ||
      title.toLowerCase().includes('closure') ||
      title.toLowerCase().includes('holiday') && description?.toLowerCase().includes('closed')
    ) {
      return null
    }

    // Skip bulk trash collection
    if (title.toLowerCase().includes('bulk trash') || title.toLowerCase().includes('collection')) {
      return null
    }

    return {
      title: decodeHtmlEntities(title),
      description: description || null,
      startDate,
      endDate,
      venue,
      address,
      city: CITY,
      isNyackProper: true,
      category: Category.COMMUNITY_GOVERNMENT,
      price: null,
      isFree: true, // Government events are typically free
      isFamilyFriendly: isFamilyEvent(title),
      sourceUrl,
      sourceName: SOURCE_NAME,
      imageUrl: null,
    }
  } catch {
    return null
  }
}

/**
 * Parse date and time from RSS format
 * Date format: "Thursday, January 22, 2026" or "January 22, 2026"
 * Time format: "7:00 PM" or "7:00 AM"
 */
function parseDateTimeFromRss(dateStr: string, timeStr?: string): Date | null {
  try {
    // Remove day name if present (e.g., "Thursday, ")
    const cleanDateStr = dateStr.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*/i, '')

    // Parse the date part
    const dateMatch = cleanDateStr.match(/(\w+)\s+(\d{1,2}),?\s*(\d{4})/)
    if (!dateMatch) {
      return null
    }

    const month = getMonthNumber(dateMatch[1])
    const day = parseInt(dateMatch[2], 10)
    const year = parseInt(dateMatch[3], 10)

    if (month === -1) {
      return null
    }

    // Default to midnight if no time provided
    let hour = 0
    let minute = 0

    if (timeStr) {
      const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
      if (timeMatch) {
        hour = parseInt(timeMatch[1], 10)
        minute = parseInt(timeMatch[2], 10)
        const ampm = timeMatch[3].toUpperCase()

        if (ampm === 'PM' && hour !== 12) {
          hour += 12
        } else if (ampm === 'AM' && hour === 12) {
          hour = 0
        }
      }
    }

    return new Date(year, month, day, hour, minute)
  } catch {
    return null
  }
}

/**
 * Convert month name to 0-indexed number
 */
function getMonthNumber(month: string): number {
  const months: Record<string, number> = {
    january: 0, jan: 0,
    february: 1, feb: 1,
    march: 2, mar: 2,
    april: 3, apr: 3,
    may: 4,
    june: 5, jun: 5,
    july: 6, jul: 6,
    august: 7, aug: 7,
    september: 8, sep: 8, sept: 8,
    october: 9, oct: 9,
    november: 10, nov: 10,
    december: 11, dec: 11,
  }
  return months[month.toLowerCase()] ?? -1
}

/**
 * Determine if event is family-friendly based on title
 */
function isFamilyEvent(title: string): boolean {
  const familyKeywords = [
    'parade',
    'halloween',
    'street fair',
    'penguin plunge',
    'festival',
    'celebration',
  ]
  const lowerTitle = title.toLowerCase()
  return familyKeywords.some((keyword) => lowerTitle.includes(keyword))
}
