import { Category } from '@/generated/prisma/enums'

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
}

/**
 * Interface that all scrapers must implement
 */
export interface Scraper {
  name: string
  scrape(): Promise<ScraperResult>
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
