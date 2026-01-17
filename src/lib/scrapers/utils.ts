import * as cheerio from 'cheerio'
import crypto from 'crypto'
import { Category } from '@/generated/prisma/enums'
import { guessCategory } from '@/lib/utils/categories'
import { JsonLdEvent, ScrapedEvent } from './types'

/**
 * Generate a hash for deduplication based on title, venue, and startDate
 */
export function generateEventHash(title: string, venue: string, startDate: Date): string {
  const normalized = `${title.toLowerCase().trim()}|${venue.toLowerCase().trim()}|${startDate.toISOString()}`
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 32)
}

/**
 * Extract JSON-LD Event data from HTML
 */
export function extractJsonLdEvents(html: string): JsonLdEvent[] {
  const $ = cheerio.load(html)
  const events: JsonLdEvent[] = []

  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const content = $(element).html()
      if (!content) return

      const data = JSON.parse(content)

      // Handle single event or array of events
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item['@type'] === 'Event') {
            events.push(item as JsonLdEvent)
          }
        }
      } else if (data['@type'] === 'Event') {
        events.push(data as JsonLdEvent)
      }
    } catch {
      // Ignore JSON parse errors
    }
  })

  return events
}

/**
 * Determine if an event is in Nyack proper vs surrounding area
 */
export function isNyackProper(city: string): boolean {
  const nyackCities = ['nyack', 'south nyack', 'upper nyack']
  return nyackCities.includes(city.toLowerCase().trim())
}

/**
 * List of nearby cities to include in scraping
 */
export const nearbyCities = [
  'nyack',
  'south nyack',
  'upper nyack',
  'west nyack',
  'valley cottage',
  'piermont',
  'grandview',
  'grand view',
  'sparkill',
  'tappan',
  'orangeburg',
  'blauvelt',
  'palisades',
  'nanuet',
  'new city',
  'congers',
  'haverstraw',
  'garnerville',
  'stony point',
  'ossining',
  'tarrytown',
  'sleepy hollow',
  'irvington',
]

/**
 * Check if a city is within our coverage area
 */
export function isInCoverageArea(city: string): boolean {
  return nearbyCities.includes(city.toLowerCase().trim())
}

/**
 * Parse price from various formats and determine if free
 */
export function parsePrice(priceData: string | number | undefined | null): { price: string | null; isFree: boolean } {
  if (!priceData) {
    return { price: null, isFree: false }
  }

  const priceStr = String(priceData).toLowerCase().trim()

  // Check for free indicators
  if (priceStr === '0' || priceStr === 'free' || priceStr === '$0' || priceStr === '$0.00') {
    return { price: null, isFree: true }
  }

  // Format the price string
  if (typeof priceData === 'number') {
    if (priceData === 0) {
      return { price: null, isFree: true }
    }
    return { price: `$${priceData}`, isFree: false }
  }

  // Already formatted string
  return { price: priceStr.startsWith('$') ? priceStr : `$${priceStr}`, isFree: false }
}

/**
 * Check if event appears to be family-friendly based on content
 */
export function guessFamilyFriendly(title: string, description?: string | null): boolean {
  const text = `${title} ${description || ''}`.toLowerCase()

  const familyKeywords = [
    'family',
    'kids',
    'children',
    'all ages',
    'youth',
    'teens',
    'child-friendly',
    'kid-friendly',
    'family-friendly',
  ]

  const adultKeywords = [
    '21+',
    '21 and over',
    'adults only',
    'bar',
    'cocktail',
    'wine tasting',
    'beer tasting',
    'late night',
  ]

  // If explicitly adult-oriented, not family-friendly
  for (const keyword of adultKeywords) {
    if (text.includes(keyword)) {
      return false
    }
  }

  // If has family keywords, is family-friendly
  for (const keyword of familyKeywords) {
    if (text.includes(keyword)) {
      return true
    }
  }

  // Default to false (unknown)
  return false
}

/**
 * Convert a JSON-LD event to our ScrapedEvent format
 */
export function jsonLdToScrapedEvent(
  jsonLd: JsonLdEvent,
  sourceName: string,
  sourceUrl: string
): ScrapedEvent | null {
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

    // Extract venue and address
    const venue = jsonLd.location?.name || 'Unknown Venue'
    const address = jsonLd.location?.address?.streetAddress || null
    const city = jsonLd.location?.address?.addressLocality || 'Nyack'

    // Skip if not in coverage area
    if (!isInCoverageArea(city)) {
      return null
    }

    // Parse price
    let priceData: string | number | undefined
    if (jsonLd.offers) {
      const offer = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers
      priceData = offer?.price
    }
    const { price, isFree } = parsePrice(priceData)

    // Get description - clean HTML entities
    let description = jsonLd.description || null
    if (description) {
      // Basic HTML entity decoding
      description = description
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/<[^>]*>/g, '') // Strip HTML tags
        .trim()
    }

    // Get image URL
    let imageUrl: string | null = null
    if (jsonLd.image) {
      imageUrl = Array.isArray(jsonLd.image) ? jsonLd.image[0] : jsonLd.image
    }

    // Use event URL if provided, otherwise use source URL
    const eventUrl = jsonLd.url || sourceUrl

    return {
      title: jsonLd.name.trim(),
      description,
      startDate,
      endDate,
      venue,
      address,
      city,
      isNyackProper: isNyackProper(city),
      category: guessCategory(jsonLd.name, description),
      price,
      isFree,
      isFamilyFriendly: guessFamilyFriendly(jsonLd.name, description),
      sourceUrl: eventUrl,
      sourceName,
      imageUrl,
    }
  } catch {
    return null
  }
}

/**
 * Strip HTML tags from a string
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

/**
 * Fetch a URL with error handling and timeout
 */
export async function fetchWithTimeout(
  url: string,
  timeoutMs: number = 10000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'NyackToday/1.0 (Events Aggregator)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}
