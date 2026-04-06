import { Scraper, ScraperResult, ScrapedEvent } from './types'
import { parsePrice, guessFamilyFriendly, makeEasternDate } from './utils'
import { guessCategory } from '@/lib/utils/categories'
import puppeteer from 'puppeteer-core'
import type { Browser } from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import * as path from 'path'

const SOURCE_NAME = 'Scott & Joe'
const SOURCE_URL = 'https://www.scottandjoe.co/classes-events'
// Events are served via Acuity Scheduling (Squarespace Scheduling) iframe
const ACUITY_URL = 'https://app.squarespacescheduling.com/schedule.php?owner=29264403'
const VENUE = 'Scott & Joe'
const ADDRESS = '4 South Broadway'
const CITY = 'Nyack'

const MONTH_NAME_TO_INDEX: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
}

/**
 * Parse "Thursday, April 9 · 6:30–8:00 PM" from the description text.
 * Returns a Date or null.
 */
function parseDateFromDescription(text: string): Date | null {
  // Strip "SOLD OUT" prefix and normalize
  const cleaned = text.replace(/^SOLD\s+OUT\s*/i, '').trim()

  // Match: "Thursday, April 9 · 6:30–8:00 PM" or "Thursday, April 9 · 6:30-8:00 PM"
  const match = cleaned.match(
    /\w+day,\s+(\w+)\s+(\d+)\s+[·•]\s+(\d+):(\d+)[–\-](\d+:\d+)\s*(AM|PM)/i
  )
  if (!match) return null

  const monthName = match[1].toLowerCase()
  const day = parseInt(match[2], 10)
  let hour = parseInt(match[3], 10)
  const minute = parseInt(match[4], 10)
  const ampm = match[6].toUpperCase()

  const monthIndex = MONTH_NAME_TO_INDEX[monthName]
  if (monthIndex === undefined) return null

  if (ampm === 'PM' && hour !== 12) hour += 12
  if (ampm === 'AM' && hour === 12) hour = 0

  // Infer year
  const now = new Date()
  let year = now.getFullYear()
  const candidate = new Date(year, monthIndex, day, hour, minute)
  if (candidate < now) year++

  return makeEasternDate(year, monthIndex, day, hour, minute)
}

/**
 * Scraper for Scott & Joe cheese shop / wine bistro events in Nyack
 * Uses Puppeteer to scrape the Acuity Scheduling iframe directly
 */
export const scottAndJoeScraper: Scraper = {
  name: SOURCE_NAME,

  async scrape(): Promise<ScraperResult> {
    const events: ScrapedEvent[] = []
    let browser: Browser | null = null

    try {
      const isVercel = !!process.env.VERCEL_ENV

      if (isVercel) {
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

      await page.goto(ACUITY_URL, { waitUntil: 'networkidle2', timeout: 30000 })
      await page.waitForSelector('.select-item.select-item-box', { timeout: 15000 })

      const rawEvents = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.select-item.select-item-box')).map(el => ({
          title: el.querySelector('.appointment-type-name')?.textContent?.trim() || '',
          price: el.querySelector('.duration-container span')?.textContent?.trim() || '',
          description: el.querySelector('.type-description')?.textContent?.trim() || '',
          imageUrl: (el.querySelector('img') as HTMLImageElement)?.src || null,
        }))
      })

      const now = new Date()

      for (const raw of rawEvents) {
        if (!raw.title) continue

        const startDate = parseDateFromDescription(raw.description)
        if (!startDate || startDate <= now) continue

        // Extract description text after the date line
        const descLines = raw.description.replace(/^SOLD\s+OUT\s*/i, '').trim().split('\n\n')
        // First line is the date, rest is description
        const descText = descLines.slice(1).join('\n\n').replace(/\s+/g, ' ').trim() || null

        const { price, isFree } = parsePrice(raw.price || null)

        events.push({
          title: raw.title,
          description: descText,
          startDate,
          endDate: null,
          venue: VENUE,
          address: ADDRESS,
          city: CITY,
          isNyackProper: true,
          category: guessCategory(raw.title, descText),
          price,
          isFree,
          isFamilyFriendly: guessFamilyFriendly(raw.title, descText),
          sourceUrl: SOURCE_URL,
          sourceName: SOURCE_NAME,
          imageUrl: raw.imageUrl,
        })
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
