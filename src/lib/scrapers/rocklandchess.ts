import * as cheerio from 'cheerio'
import { Category } from '@prisma/client'
import { Scraper, ScraperResult, ScrapedEvent } from './types'
import { fetchWithTimeout, guessFamilyFriendly } from './utils'

const SOURCE_NAME = 'Rockland County Chess Club'
const SOURCE_URL = 'https://www.rocklandchess.org/events/'
const VENUE = 'Rockland County Chess Club'
const ADDRESS = '7 N Broadway'
const CITY = 'Nyack'

interface RocklandChessEvent {
  id: string
  title: string
  date: string   // "$D2026-03-24T23:00:00.000Z" (React RSC Date serialization)
  time: string   // "19:00" (24h, local Eastern time)
  category: string // "classes" | "casual"
  description: string
  location: string
}

/**
 * Extract the events array from Next.js RSC payload embedded in script tags.
 * Next.js RSC serializes data into self.__next_f.push([N, "<json-string>"]) calls.
 */
function extractEventsFromHtml(html: string): RocklandChessEvent[] {
  const $ = cheerio.load(html)
  let events: RocklandChessEvent[] = []

  $('script').each((_, el) => {
    const text = $(el).html() || ''
    // Only look at scripts with event data
    if (!text.includes('"events":[') && !text.includes('\\"events\\":[')) return

    // Match the JSON string argument: self.__next_f.push([N, "..."])
    // Uses a pattern that correctly handles escaped chars inside the string
    const match = text.match(/push\(\[\d+,"((?:[^"\\]|\\.)*)"\)/)
    if (!match) return

    try {
      // match[1] is the raw (still-escaped) string content.
      // Wrapping in quotes and JSON.parsing unescapes it.
      const unescaped: string = JSON.parse('"' + match[1] + '"')

      // Strip RSC chunk ID prefix, e.g. "12:[...]" → "[...]"
      const jsonStr = unescaped.replace(/^\d+:/, '')
      const parsed: unknown = JSON.parse(jsonStr)

      // RSC array format: ["$", "$L1b", null, { events: [...] }]
      if (
        Array.isArray(parsed) &&
        parsed[3] != null &&
        Array.isArray((parsed[3] as Record<string, unknown>).events)
      ) {
        events = (parsed[3] as { events: RocklandChessEvent[] }).events
        return false // break .each()
      }
    } catch {
      // try next script tag
    }
  })

  return events
}

/**
 * Build a Date from the RSC date string and 24h time string.
 * date: "$D2026-03-24T23:00:00.000Z" (UTC, represents 7 PM Eastern)
 * time: "19:00" (local Eastern time)
 * Uses UTC date components + local time to match the other scrapers' convention.
 */
function parseEventDate(dateStr: string, timeStr: string): Date | null {
  try {
    const iso = dateStr.replace(/^\$D/, '')
    const utc = new Date(iso)
    if (isNaN(utc.getTime())) return null

    const [h, m] = timeStr.split(':').map(Number)
    // Construct using UTC date components + local hour/minute (no TZ conversion)
    return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(), h, m, 0, 0)
  } catch {
    return null
  }
}

function mapCategory(raw: string): Category {
  switch (raw) {
    case 'classes': return Category.CLASSES_WORKSHOPS
    case 'casual':  return Category.SPORTS_RECREATION
    default:        return Category.OTHER
  }
}

/**
 * Scraper for Rockland County Chess Club
 * Uses Cheerio — event data is embedded in Next.js RSC payload script tags (SSR)
 */
export const rocklandChessScraper: Scraper = {
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
      const rawEvents = extractEventsFromHtml(html)

      if (rawEvents.length === 0) {
        return {
          sourceName: SOURCE_NAME,
          events: [],
          status: 'partial',
          errorMessage: 'No events found in RSC payload',
        }
      }

      const now = new Date()

      for (const raw of rawEvents) {
        if (!raw.title || !raw.date) continue

        const startDate = parseEventDate(raw.date, raw.time)
        if (!startDate || startDate <= now) continue

        events.push({
          title: raw.title.trim(),
          description: raw.description?.trim() || null,
          startDate,
          endDate: null,
          venue: VENUE,
          address: ADDRESS,
          city: CITY,
          isNyackProper: true,
          category: mapCategory(raw.category),
          price: '$10',
          isFree: false,
          isFamilyFriendly: guessFamilyFriendly(raw.title, raw.description),
          sourceUrl: SOURCE_URL,
          sourceName: SOURCE_NAME,
          imageUrl: null,
        })
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
