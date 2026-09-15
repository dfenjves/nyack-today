/**
 * Dry run for the admin "Test" button.
 *
 * Fetches and extracts exactly as a real run would, but writes nothing —
 * no Event rows, no EventSubmission rows, no ScraperLog. Shared by both test
 * endpoints so testing a saved source and testing an unsaved form give
 * identical results.
 */

import { SourceConfig, extractEventsForSource } from '@/lib/scrapers/generic'

export interface DryRunEvent {
  title: string
  description: string | null
  /** ISO instant — the client renders it in Eastern. */
  startDate: string
  endDate: string | null
  venue: string
  address: string | null
  city: string
  category: string
  price: string | null
  isFree: boolean
  isFamilyFriendly: boolean
  sourceUrl: string
  imageUrl: string | null
}

export interface DryRunResponse {
  sourceName: string
  fetchMode: string
  elapsedMs: number
  eventCount: number
  events: DryRunEvent[]
  warnings: string[]
  pages: {
    url: string
    fetchMode: string
    textLength: number
    estimatedTokens: number
    elapsedMs: number
    eventsFound: number
    truncated: boolean
  }[]
}

export async function dryRunSource(config: SourceConfig): Promise<DryRunResponse> {
  const startedAt = Date.now()
  const { events, warnings, pages } = await extractEventsForSource(config)

  return {
    sourceName: config.name,
    fetchMode: config.fetchMode,
    elapsedMs: Date.now() - startedAt,
    eventCount: events.length,
    events: events.map((event) => ({
      title: event.title,
      description: event.description,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate ? event.endDate.toISOString() : null,
      venue: event.venue,
      address: event.address,
      city: event.city,
      category: event.category,
      price: event.price,
      isFree: event.isFree,
      isFamilyFriendly: event.isFamilyFriendly,
      sourceUrl: event.sourceUrl,
      imageUrl: event.imageUrl,
    })),
    warnings,
    pages,
  }
}
