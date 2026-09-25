import { Category } from '@prisma/client'

/**
 * Represents an event scraped from an external source
 * before being saved to the database
 */
export interface ScrapedEvent {
  title: string
  description: string | null
  startDate: Date
  endDate: Date | null
  venue: string
  address: string | null
  city: string
  isNyackProper: boolean
  category: Category
  price: string | null
  isFree: boolean
  isFamilyFriendly: boolean
  sourceUrl: string
  sourceName: string
  imageUrl: string | null
}

/**
 * Result of a scraper run
 */
export interface ScraperResult {
  sourceName: string
  events: ScrapedEvent[]
  status: 'success' | 'error' | 'partial'
  errorMessage?: string
  /**
   * How many events the source produced, when that differs from `events.length`.
   *
   * Scrapers that route their events to `EventSubmission` for review (the
   * generic source scraper) return an empty `events` array but still need
   * ScraperLog — and therefore /admin/pulse — to show a live source rather than
   * a source stuck at zero. Defaults to `events.length`.
   */
  eventsFound?: number
  /**
   * Wall-clock time the scrape took, in milliseconds. Filled in by the
   * orchestrator (see `runAllScrapers`), not by the scrapers themselves, so
   * `/api/scrape` and the GitHub Actions log can show where the 300 s Vercel
   * budget actually goes.
   */
  durationMs?: number
}

/**
 * Interface that all scrapers must implement
 */
export interface Scraper {
  name: string
  scrape(): Promise<ScraperResult>
  /**
   * How long this scraper may run before the orchestrator abandons it and logs
   * a timeout. Generic sources set this from their fetch mode (a Puppeteer
   * render needs far longer than an iCal fetch); static scrapers leave it unset
   * and get `DEFAULT_SCRAPER_TIMEOUT_MS`.
   */
  timeoutMs?: number
}

/**
 * JSON-LD Event schema from schema.org
 * Used by The Events Calendar plugin (visitnyack.org, theangelnyack.com)
 */
export interface JsonLdEvent {
  '@context': string
  '@type': string
  name: string
  description?: string
  startDate: string
  endDate?: string
  url?: string
  image?: string | string[]
  location?: {
    '@type': string
    name?: string
    address?: {
      '@type': string
      streetAddress?: string
      addressLocality?: string
      addressRegion?: string
      postalCode?: string
    }
  }
  offers?: {
    '@type': string
    price?: string | number
    priceCurrency?: string
    availability?: string
    url?: string
  } | Array<{
    '@type': string
    price?: string | number
    priceCurrency?: string
    availability?: string
    url?: string
  }>
  performer?: {
    '@type': string
    name?: string
  } | Array<{
    '@type': string
    name?: string
  }>
  organizer?: {
    '@type': string
    name?: string
    url?: string
  }
}
