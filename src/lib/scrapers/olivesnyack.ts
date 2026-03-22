import { Scraper, ScraperResult, ScrapedEvent } from './types'
import { guessFamilyFriendly } from './utils'
import { guessCategory } from '@/lib/utils/categories'
import { Category } from '@prisma/client'
import puppeteer from 'puppeteer-core'
import type { Browser } from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import * as path from 'path'

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
 * Returns the event name (prefix) and time components, or null.
 */
function parseEventText(text: string): { name: string; hour: number; minute: number } | null {
  const match = text.match(/^(.*?)\s+(\d+)(?::(\d+))?\s*(AM|PM)\s*$/i)
  if (!match) return null
  const name = match[1].trim().replace(/\u200B/g, '').trim() // strip zero-width spaces
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
  let daysUntil = (dayOfWeek - todayDow + 7) % 7

  for (let i = 0; i < count; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + daysUntil + i * 7)
    d.setHours(hour, minute, 0, 0)
    // Skip if in the past (e.g., today's event already happened)
    if (d > now) {
      dates.push(d)
    }
  }
  return dates
}

/**
 * Parse a specific dated event like "FRIDAY, MARCH 20th: GLASS PONY 9:00 PM"
 */
function parseSpecificEvent(text: string): ScrapedEvent | null {
  const match = text.match(
    /^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY),?\s+(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+(\d+)(?:st|nd|rd|th)?:\s+(.+?)\s+(\d+)(?::(\d+))?\s*(AM|PM)/i
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

  // Infer year
  const now = new Date()
  let year = now.getFullYear()
  const candidate = new Date(year, monthIndex, day, hour, minute)
  if (candidate < now) year++

  const startDate = new Date(year, monthIndex, day, hour, minute)

  return {
    title,
    description: null,
    startDate,
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
 * Scraper for Olive's Nyack weekly music calendar
 * Uses Puppeteer (Wix site, JS-rendered)
 */
export const olivesNyackScraper: Scraper = {
  name: SOURCE_NAME,

  async scrape(): Promise<ScraperResult> {
    const events: ScrapedEvent[] = []
    let browser: Browser | null = null

    try {
      const isProduction = process.env.VERCEL_ENV === 'production'

      if (isProduction) {
        if (!process.env.AWS_LAMBDA_JS_RUNTIME) {
          process.env.AWS_LAMBDA_JS_RUNTIME = 'nodejs22.x'
        }
        const executablePath = await chromium.executablePath()
        const execDir = path.dirname(executablePath)
        process.env.LD_LIBRARY_PATH = execDir
        browser = await puppeteer.launch({
          args: chromium.args,
          executablePath,
          headless: true,
        })
      } else {
        const executablePath = process.env.CHROME_BIN ||
          '/Users/danielfenjves/.cache/puppeteer/chrome/mac_arm-146.0.7680.31/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
        browser = await puppeteer.launch({
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
          executablePath,
          headless: true,
        })
      }

      const page = await browser.newPage()
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      )

      await page.goto(SOURCE_URL, { waitUntil: 'networkidle2', timeout: 30000 })
      await page.waitForSelector('.wixui-rich-text', { timeout: 10000 })

      // Extract all rich text block contents in DOM order
      const blocks: string[] = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.wixui-rich-text'))
          .map(el => el.textContent?.trim().replace(/\u200B/g, '').replace(/\s+/g, ' ').trim() || '')
          .filter(t => t.length > 0)
      })

      const now = new Date()

      for (let i = 0; i < blocks.length; i++) {
        const text = blocks[i].toUpperCase()

        // Check if this block is a standalone day-of-week name (recurring slot header)
        const dayMatch = text.match(/^(SUNDAYS|MONDAYS|TUESDAYS|WEDNESDAYS|THURSDAYS|FRIDAYS|SATURDAYS)$/)
        if (dayMatch) {
          const dayName = dayMatch[1].replace(/S$/, '') // "SUNDAYS" -> "SUNDAY"
          const dow = DAY_NAME_TO_DOW[dayName]
          const nextBlock = blocks[i + 1] || ''

          // Skip promos
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

        // Check if this block is a specific dated event like "FRIDAY, MARCH 20th: GLASS PONY 9:00 PM"
        const specificEvent = parseSpecificEvent(blocks[i])
        if (specificEvent) {
          if (specificEvent.startDate > now) {
            events.push(specificEvent)
          }
        }
      }

      await browser.close()

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
      if (browser) await browser.close()
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
