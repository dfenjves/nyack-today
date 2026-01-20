import * as cheerio from 'cheerio'
import { Category } from '@prisma/client'
import { Scraper, ScraperResult, ScrapedEvent } from './types'
import { fetchWithTimeout, decodeHtmlEntities, stripHtml } from './utils'

const SOURCE_NAME = 'Rivertown Film'
const SOURCE_URL = 'https://rivertownfilm.org/'
const VENUE_NAME = 'The Nyack Center'
const CITY = 'Nyack'
const ADDRESS = '58 Depew Ave, Nyack, NY 10960'

/**
 * Scraper for Rivertown Film Society
 * Uses HTML parsing - no JSON-LD available
 */
export const rivertownFilmScraper: Scraper = {
  name: SOURCE_NAME,

  async scrape(): Promise<ScraperResult> {
    const events: ScrapedEvent[] = []

    try {
      const response = await fetchWithTimeout(SOURCE_URL)

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

      // Find all text modules that might contain film info
      // Look for sections containing film titles (h2) and eventive ticket links
      const filmSections = new Set<string>()

      // Find all eventive ticket links and trace back to their parent sections
      $('a[href*="eventive.org"]').each((_, link) => {
        const $link = $(link)
        // Get the parent row/section
        const $section = $link.closest('.et_pb_row')
        if ($section.length) {
          const sectionHtml = $.html($section)
          filmSections.add(sectionHtml)
        }
      })

      // Also look for h2 elements that might be film titles
      $('h2').each((_, h2) => {
        const $h2 = $(h2)
        const text = $h2.text().trim()
        // Skip navigation/header h2s
        if (text && !text.includes('Menu') && !text.includes('Navigation')) {
          const $section = $h2.closest('.et_pb_row')
          if ($section.length) {
            // Check if this section has screening info
            const sectionText = $section.text()
            if (
              sectionText.includes('pm') ||
              sectionText.includes('PM') ||
              sectionText.includes('Nyack Center') ||
              sectionText.includes('eventive')
            ) {
              const sectionHtml = $.html($section)
              filmSections.add(sectionHtml)
            }
          }
        }
      })

      // Process each unique film section
      for (const sectionHtml of filmSections) {
        const $section = cheerio.load(sectionHtml)
        const event = parseFilmSection($section)
        if (event) {
          events.push(event)
        }
      }

      if (events.length === 0) {
        return {
          sourceName: SOURCE_NAME,
          events: [],
          status: 'partial',
          errorMessage: 'No film events found on page',
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

/**
 * Parse a film section to extract event data
 */
function parseFilmSection($: cheerio.CheerioAPI): ScrapedEvent | null {
  try {
    // Extract title from h2
    let title = $('h2').first().text().trim()
    if (!title) {
      // Try h3 or strong as fallback
      title = $('h3').first().text().trim() || $('strong').first().text().trim()
    }
    if (!title) {
      return null
    }
    title = decodeHtmlEntities(title)

    // Extract screening date/time from strong tags or text
    let screeningDate: Date | null = null
    const textContent = $.root().text()

    // Look for date patterns like "Wednesday, January 28, 8:00 pm"
    const datePatterns = [
      // Full format: "Wednesday, January 28, 8:00 pm"
      /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(\w+)\s+(\d{1,2}),?\s+(\d{1,2}):(\d{2})\s*(am|pm)/i,
      // Short format: "Jan 28, 8:00 pm"
      /(\w+)\s+(\d{1,2}),?\s+(\d{1,2}):(\d{2})\s*(am|pm)/i,
      // Date with year: "January 28, 2026, 8:00 pm"
      /(\w+)\s+(\d{1,2}),?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})\s*(am|pm)/i,
    ]

    for (const pattern of datePatterns) {
      const match = textContent.match(pattern)
      if (match) {
        screeningDate = parseDateFromMatch(match)
        if (screeningDate) break
      }
    }

    if (!screeningDate) {
      return null
    }

    // Skip past events
    if (screeningDate < new Date()) {
      return null
    }

    // Extract ticket URL
    let sourceUrl = SOURCE_URL
    const ticketLink = $('a[href*="eventive.org"]').first()
    if (ticketLink.length) {
      sourceUrl = ticketLink.attr('href') || SOURCE_URL
    }

    // Extract price from ticket link text
    let price: string | null = null
    let isFree = false
    const ticketText = ticketLink.text()
    const priceMatch = ticketText.match(/\$[\d,]+(?:\s*[,-]\s*\$[\d,]+)*/i)
    if (priceMatch) {
      price = priceMatch[0]
    } else if (ticketText.toLowerCase().includes('free')) {
      isFree = true
    }

    // Extract description from paragraph text
    let description: string | null = null
    const paragraphs = $('p')
      .map((_, p) => $(p).text().trim())
      .get()
      .filter((p) => p.length > 50) // Get substantial paragraphs
    if (paragraphs.length > 0) {
      description = decodeHtmlEntities(stripHtml(paragraphs[0]))
      // Limit description length
      if (description.length > 500) {
        description = description.substring(0, 497) + '...'
      }
    }

    // Extract image URL
    let imageUrl: string | null = null
    const img = $('img').first()
    if (img.length) {
      imageUrl = img.attr('src') || img.attr('data-src') || null
    }

    return {
      title,
      description,
      startDate: screeningDate,
      endDate: null,
      venue: VENUE_NAME,
      address: ADDRESS,
      city: CITY,
      isNyackProper: true,
      category: Category.MOVIES,
      price,
      isFree,
      isFamilyFriendly: false, // Default for film screenings
      sourceUrl,
      sourceName: SOURCE_NAME,
      imageUrl,
    }
  } catch {
    return null
  }
}

/**
 * Parse a date from regex match groups
 */
function parseDateFromMatch(match: RegExpMatchArray): Date | null {
  try {
    const now = new Date()
    const currentYear = now.getFullYear()

    // Different match group structures based on pattern
    let month: string
    let day: number
    let hour: number
    let minute: number
    let ampm: string
    let year = currentYear

    if (match.length === 6) {
      // Format: "Wednesday, January 28, 8:00 pm" - groups: [full, month, day, hour, min, ampm]
      month = match[1]
      day = parseInt(match[2], 10)
      hour = parseInt(match[3], 10)
      minute = parseInt(match[4], 10)
      ampm = match[5].toLowerCase()
    } else if (match.length === 7) {
      // Format with year: "January 28, 2026, 8:00 pm" - groups: [full, month, day, year, hour, min, ampm]
      month = match[1]
      day = parseInt(match[2], 10)
      year = parseInt(match[3], 10)
      hour = parseInt(match[4], 10)
      minute = parseInt(match[5], 10)
      ampm = match[6].toLowerCase()
    } else {
      return null
    }

    // Convert month name to number
    const monthNum = getMonthNumber(month)
    if (monthNum === -1) return null

    // Convert to 24-hour format
    if (ampm === 'pm' && hour !== 12) {
      hour += 12
    } else if (ampm === 'am' && hour === 12) {
      hour = 0
    }

    // Create date
    const date = new Date(year, monthNum, day, hour, minute)

    // If date is in the past and we're using current year, try next year
    if (date < now && year === currentYear) {
      date.setFullYear(currentYear + 1)
    }

    return date
  } catch {
    return null
  }
}

/**
 * Convert month name to 0-indexed number
 */
function getMonthNumber(month: string): number {
  const months: Record<string, number> = {
    january: 0,
    jan: 0,
    february: 1,
    feb: 1,
    march: 2,
    mar: 2,
    april: 3,
    apr: 3,
    may: 4,
    june: 5,
    jun: 5,
    july: 6,
    jul: 6,
    august: 7,
    aug: 7,
    september: 8,
    sep: 8,
    sept: 8,
    october: 9,
    oct: 9,
    november: 10,
    nov: 10,
    december: 11,
    dec: 11,
  }
  return months[month.toLowerCase()] ?? -1
}
