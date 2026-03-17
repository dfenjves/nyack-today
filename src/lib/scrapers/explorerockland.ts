import { Category } from '@prisma/client'
import { Scraper, ScraperResult, ScrapedEvent } from './types'
import { parsePrice, guessFamilyFriendly } from './utils'
import puppeteer from 'puppeteer-core'
import type { Browser } from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import * as path from 'path'

const SOURCE_NAME = 'Explore Rockland'
const SOURCE_URL = 'https://explorerocklandny.com/events'

// Cities we care about
const ALLOWED_CITIES = ['nyack', 'west nyack', 'upper nyack']

/**
 * Guess event category based on title and description
 */
function guessCategory(title: string, description: string): Category {
  const combined = `${title} ${description}`.toLowerCase()

  if (combined.match(/\b(concert|music|jazz|band|singer|guitar|piano|orchestra)\b/i)) {
    return Category.MUSIC
  }
  if (combined.match(/\b(comedy|comedian|stand-up|improv|funny)\b/i)) {
    return Category.COMEDY
  }
  if (combined.match(/\b(movie|film|cinema|screening)\b/i)) {
    return Category.MOVIES
  }
  if (combined.match(/\b(play|theater|theatre|musical|performance|show)\b/i)) {
    return Category.THEATER
  }
  if (combined.match(/\b(kids|children|family|families|youth)\b/i)) {
    return Category.FAMILY_KIDS
  }
  if (combined.match(/\b(restaurant|dining|food|wine|tasting|culinary|cooking)\b/i)) {
    return Category.FOOD_DRINK
  }
  if (combined.match(/\b(sports|athletic|fitness|race|marathon|game)\b/i)) {
    return Category.SPORTS_RECREATION
  }
  if (combined.match(/\b(art|gallery|exhibition|museum|painting|sculpture)\b/i)) {
    return Category.ART_GALLERIES
  }
  if (combined.match(/\b(class|workshop|seminar|course|training|lesson)\b/i)) {
    return Category.CLASSES_WORKSHOPS
  }
  if (combined.match(/\b(meeting|council|government|town hall|public)\b/i)) {
    return Category.COMMUNITY_GOVERNMENT
  }

  return Category.OTHER
}

/**
 * Scraper for Explore Rockland events calendar
 * Uses Puppeteer to handle JavaScript-rendered content
 */
export const exploreRocklandScraper: Scraper = {
  name: SOURCE_NAME,

  async scrape(): Promise<ScraperResult> {
    const events: ScrapedEvent[] = []
    let browser: Browser | null = null

    try {
      // Launch Puppeteer with appropriate config for environment
      const isProduction = process.env.VERCEL_ENV === 'production'

      if (isProduction) {
        // Vercel/serverless: use @sparticuz/chromium

        // Set runtime (fallback if not in Vercel Dashboard)
        if (!process.env.AWS_LAMBDA_JS_RUNTIME) {
          process.env.AWS_LAMBDA_JS_RUNTIME = 'nodejs22.x'
        }

        // Disable graphics mode to prevent freezing
        if (typeof chromium.setGraphicsMode === 'function') {
          chromium.setGraphicsMode(false)
        }

        // Get executable path and set library path
        const executablePath = await chromium.executablePath()
        const execDir = path.dirname(executablePath)

        // CRITICAL: Set LD_LIBRARY_PATH so Chromium can find libraries
        process.env.LD_LIBRARY_PATH = execDir

        browser = await puppeteer.launch({
          args: chromium.args,
          executablePath,
          headless: true,
        })
      } else {
        // Local development: use Puppeteer's Chrome
        // You can set CHROME_BIN env var to override
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

      // Navigate to events page
      await page.goto(SOURCE_URL, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      })

      // Wait for events to load
      await page.waitForSelector('.tribe-events-calendar-list__event-row', {
        timeout: 10000,
      })

      // Extract event data from the page
      const eventData = await page.evaluate(() => {
        const eventElements = Array.from(
          document.querySelectorAll('.tribe-events-calendar-list__event-row')
        )

        return eventElements.map((event) => {
          const titleEl = event.querySelector('.tribe-events-calendar-list__event-title-link')
          const dateEl = event.querySelector('.tribe-events-calendar-list__event-datetime')
          const venueEl = event.querySelector('.tribe-events-calendar-list__event-venue-title')
          const addressEl = event.querySelector('.tribe-events-calendar-list__event-venue-address')
          const descEl = event.querySelector('.tribe-events-calendar-list__event-description')
          const costEl = event.querySelector('.tribe-events-calendar-list__event-cost')

          return {
            title: titleEl?.textContent?.trim() || '',
            url: (titleEl as HTMLAnchorElement)?.href || '',
            dateTime: dateEl?.getAttribute('datetime') || '',
            venue: venueEl?.textContent?.trim() || '',
            address: addressEl?.textContent?.trim() || '',
            description: descEl?.textContent?.trim() || '',
            cost: costEl?.textContent?.trim() || '',
          }
        })
      })

      // Process and filter events
      for (const event of eventData) {
        // Filter by city - only include Nyack, West Nyack, Upper Nyack
        if (!event.address) continue

        const addressLower = event.address.toLowerCase()
        const isNyackArea = ALLOWED_CITIES.some((city) => addressLower.includes(city))

        if (!isNyackArea) {
          continue // Skip events outside our target cities
        }

        // Parse date
        let startDate: Date
        try {
          if (event.dateTime) {
            startDate = new Date(event.dateTime)
          } else {
            continue // Skip if no date
          }
        } catch {
          continue // Skip if date parsing fails
        }

        // Skip past events
        const now = new Date()
        if (startDate < now) {
          continue
        }

        // Determine city
        let city = 'Nyack'
        let isNyackProper = true
        if (addressLower.includes('west nyack')) {
          city = 'West Nyack'
          isNyackProper = false
        } else if (addressLower.includes('upper nyack')) {
          city = 'Upper Nyack'
          isNyackProper = false
        }

        // Parse price
        let price: string | null = null
        let isFree = false
        if (event.cost) {
          const parsed = parsePrice(event.cost)
          price = parsed.price
          isFree = parsed.isFree
        }

        // Guess category from title and description
        const category = guessCategory(event.title, event.description)

        // Determine if family friendly
        const isFamilyFriendly = guessFamilyFriendly(event.title, event.description)

        const scrapedEvent: ScrapedEvent = {
          title: event.title,
          description: event.description || null,
          startDate,
          endDate: null,
          venue: event.venue || 'Rockland County',
          address: event.address,
          city,
          isNyackProper,
          category,
          price,
          isFree,
          isFamilyFriendly,
          sourceUrl: event.url || SOURCE_URL,
          sourceName: SOURCE_NAME,
          imageUrl: null,
        }

        events.push(scrapedEvent)
      }

      await browser.close()

      if (events.length === 0) {
        return {
          sourceName: SOURCE_NAME,
          events: [],
          status: 'partial',
          errorMessage: 'No Nyack-area events found',
        }
      }

      return {
        sourceName: SOURCE_NAME,
        events,
        status: 'success',
      }
    } catch (error) {
      if (browser) {
        await browser.close()
      }

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
