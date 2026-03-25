import * as cheerio from 'cheerio'
import { Scraper, ScraperResult, ScrapedEvent } from './types'
import { guessFamilyFriendly } from './utils'
import { guessCategory } from '@/lib/utils/categories'
import { Category } from '@prisma/client'

const SOURCE_NAME = "Olive's"
const SOURCE_URL = 'https://www.olivesnyackbar.com/'
const VENUE = "Olive's"
const ADDRESS = '118A Main St'
const CITY = 'Nyack'

// How many weeks ahead to generate recurring events
const RECURRING_WEEKS = 4

const DAY_NAME_TO_DOW: Record<string, number> = {
  SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3,
  THURSDAY: 4, FRIDAY: 5, SATURDAY: 6,
}

const MONTH_NAME_TO_INDEX: Record<string, number> = {
  JANUARY: 0, FEBRUARY: 1, MARCH: 2, APRIL: 3, MAY: 4, JUNE: 5,
  JULY: 6, AUGUST: 7, SEPTEMBER: 8, OCTOBER: 9, NOVEMBER: 10, DECEMBER: 11,
}

// Recurring events that are just promos, not real event listings
const SKIP_KEYWORDS = ['happy hour', 'all night happy hour']

/**
 * Parse a time string like "9 PM", "9:00 PM", "8:30 PM" from the end of a string.
 */
function parseEventText(text: string): { name: string; hour: number; minute: number } | null {
  const match = text.match(/^(.*?)\s+(\d+)(?::(\d+))?\s*(AM|PM)\s*$/i)
  if (!match) return null
  const name = match[1].trim().replace(/\u200B/g, '').trim()
  if (!name) return null
  let hour = parseInt(match[2], 10)
  const minute = match[3] ? parseInt(match[3], 10) : 0
  const ampm = match[4].toUpperCase()
  if (ampm === 'PM' && hour !== 12) hour += 12
  if (ampm === 'AM' && hour === 12) hour = 0
  return { name, hour, minute }
}

/**
 * Get the next N occurrences of a given day-of-week (0=Sun), starting from today.
 */
function getNextOccurrences(dayOfWeek: number, count: number, hour: number, minute: number): Date[] {
  const dates: Date[] = []
  const now = new Date()
  const todayDow = now.getDay()
  const daysUntil = (dayOfWeek - todayDow + 7) % 7

  for (let i = 0; i < count; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + daysUntil + i * 7)
    d.setHours(hour, minute, 0, 0)
    if (d > now) dates.push(d)
  }
  return dates
}

/**
 * Parse a specific dated event like "FRIDAY, MARCH 20th: GLASS PONY 9:00 PM"
 */
function parseSpecificEvent(text: string): ScrapedEvent | null {
  const match = text.match(
    /^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY),?\s+(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+(\d+)(?:st|nd|rd|th)?[:\s]+(.+?)\s+(\d+)(?::(\d+))?\s*(AM|PM)/i
  )
  if (!match) return null

  const monthIndex = MONTH_NAME_TO_INDEX[match[2].toUpperCase()]
  const day = parseInt(match[3], 10)
  const title = match[4].trim().replace(/\u200B/g, '').trim()
  let hour = parseInt(match[5], 10)
  const minute = match[6] ? parseInt(match[6], 10) : 0
  const ampm = match[7].toUpperCase()
  if (ampm === 'PM' && hour !== 12) hour += 12
  if (ampm === 'AM' && hour === 12) hour = 0

  if (!title) return null

  const now = new Date()
  let year = now.getFullYear()
  const candidate = new Date(year, monthIndex, day, hour, minute)
  if (candidate < now) year++

  return {
    title,
    description: null,
    startDate: new Date(year, monthIndex, day, hour, minute),
    endDate: null,
    venue: VENUE,
    address: ADDRESS,
    city: CITY,
    isNyackProper: true,
    category: Category.MUSIC,
    price: null,
    isFree: false,
    isFamilyFriendly: false,
    sourceUrl: SOURCE_URL,
    sourceName: SOURCE_NAME,
    imageUrl: null,
  }
}

/**
 * Scraper for Olive's Nyack weekly music calendar.
 * Wix serves SSR HTML to Googlebot — uses Cheerio, no Puppeteer needed.
 */
export const olivesNyackScraper: Scraper = {
  name: SOURCE_NAME,

  async scrape(): Promise<ScraperResult> {
    const events: ScrapedEvent[] = []

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 20000)
      const response = await fetch(SOURCE_URL, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      })
      clearTimeout(timeoutId)

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

      // Extract text from each Wix rich-text block in DOM order
      const blocks: string[] = []
      $('[data-testid="richTextElement"]').each((_, el) => {
        const text = $(el).text().replace(/\u200B/g, '').replace(/\s+/g, ' ').trim()
        if (text) blocks.push(text)
      })

      const now = new Date()

      for (let i = 0; i < blocks.length; i++) {
        const text = blocks[i].toUpperCase()

        // Recurring slot header: "SUNDAYS", "MONDAYS", etc.
        const dayMatch = text.match(/^(SUNDAYS|MONDAYS|TUESDAYS|WEDNESDAYS|THURSDAYS|FRIDAYS|SATURDAYS)$/)
        if (dayMatch) {
          const dayName = dayMatch[1].replace(/S$/, '')
          const dow = DAY_NAME_TO_DOW[dayName]
          const nextBlock = blocks[i + 1] || ''

          if (SKIP_KEYWORDS.some(kw => nextBlock.toLowerCase().includes(kw))) continue

          const parsed = parseEventText(nextBlock)
          if (!parsed) continue

          const occurrences = getNextOccurrences(dow, RECURRING_WEEKS, parsed.hour, parsed.minute)
          for (const startDate of occurrences) {
            events.push({
              title: parsed.name,
              description: null,
              startDate,
              endDate: null,
              venue: VENUE,
              address: ADDRESS,
              city: CITY,
              isNyackProper: true,
              category: guessCategory(parsed.name, null),
              price: null,
              isFree: true,
              isFamilyFriendly: guessFamilyFriendly(parsed.name),
              sourceUrl: SOURCE_URL,
              sourceName: SOURCE_NAME,
              imageUrl: null,
            })
          }
          continue
        }

        // Specific dated event: "FRIDAY, MARCH 27th: HOLLYWOOD HERB 9:00 PM"
        const specificEvent = parseSpecificEvent(blocks[i])
        if (specificEvent && specificEvent.startDate > now) {
          events.push(specificEvent)
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

      return { sourceName: SOURCE_NAME, events, status: 'success' }
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
