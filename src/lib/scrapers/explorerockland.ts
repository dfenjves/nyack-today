import * as ical from 'node-ical'
import { Scraper, ScraperResult, ScrapedEvent } from './types'
import { fetchWithTimeout, guessFamilyFriendly } from './utils'
import { guessCategory } from '@/lib/utils/categories'

const SOURCE_NAME = 'Explore Rockland'
const ICAL_URL = 'https://explorerocklandny.com/?post_type=tribe_events&ical=1&eventDisplay=list'

// Cities we care about
const ALLOWED_CITIES = ['nyack', 'west nyack', 'upper nyack', 'south nyack']

/**
 * node-ical returns string fields as either a plain string or, when the
 * property has ICS parameters (e.g. ATTACH;FMTTYPE=...), an object with a
 * `val` property.
 */
function paramValue(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'val' in value) {
    return String((value as { val: unknown }).val)
  }
  return null
}

/**
 * Scraper for Explore Rockland events.
 *
 * The site's WordPress "The Events Calendar" plugin publishes a native iCal
 * feed (the same one powering its "Add to Google Calendar" link), so we
 * parse that directly instead of scraping the rendered calendar page. No
 * headless browser needed.
 */
export const exploreRocklandScraper: Scraper = {
  name: SOURCE_NAME,

  async scrape(): Promise<ScraperResult> {
    const events: ScrapedEvent[] = []

    try {
      const response = await fetchWithTimeout(ICAL_URL, 15000)
      if (!response.ok) {
        return {
          sourceName: SOURCE_NAME,
          events: [],
          status: 'error',
          errorMessage: `HTTP ${response.status}: ${response.statusText}`,
        }
      }

      const icsText = await response.text()
      const calendar = ical.sync.parseICS(icsText)
      const now = new Date()

      for (const component of Object.values(calendar)) {
        if (!component || component.type !== 'VEVENT') continue

        const title = paramValue(component.summary)
        const location = paramValue(component.location)
        const startDate = component.start ? new Date(component.start) : null

        if (!title || !location || !startDate || isNaN(startDate.getTime())) continue

        // Filter by city - only include Nyack, West Nyack, Upper Nyack
        const locationLower = location.toLowerCase()
        const isNyackArea = ALLOWED_CITIES.some((city) => locationLower.includes(city))
        if (!isNyackArea) continue

        // Skip past events
        if (startDate < now) continue

        // Determine city
        let city = 'Nyack'
        let isNyackProper = true
        if (locationLower.includes('west nyack')) {
          city = 'West Nyack'
          isNyackProper = false
        } else if (locationLower.includes('upper nyack')) {
          city = 'Upper Nyack'
          isNyackProper = false
        } else if (locationLower.includes('south nyack')) {
          city = 'South Nyack'
          isNyackProper = false
        }

        const venue = location.split(',')[0].trim() || 'Rockland County'
        const description = paramValue(component.description)?.trim() || null
        const imageUrl = paramValue(component.attach)

        const scrapedEvent: ScrapedEvent = {
          title,
          description,
          startDate,
          endDate: component.end ? new Date(component.end) : null,
          venue,
          address: location,
          city,
          isNyackProper,
          category: guessCategory(title, description),
          price: null,
          isFree: false,
          isFamilyFriendly: guessFamilyFriendly(title, description),
          sourceUrl: component.url || ICAL_URL,
          sourceName: SOURCE_NAME,
          imageUrl,
        }

        events.push(scrapedEvent)
      }

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
