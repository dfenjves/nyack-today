import { Category } from '@prisma/client'
import { Scraper, ScraperResult, ScrapedEvent } from './types'
import { fetchWithTimeout, guessFamilyFriendly } from './utils'

const SOURCE_NAME = 'Rockland County Chess Club'
// rocklandchess.org now redirects to the club's page on chess67.com. The
// /events sub-page embeds the club's full event list (past and upcoming).
const CLUB_URL = 'https://chess67.com/club/the-rockland-county-chess-club'
const SOURCE_URL = `${CLUB_URL}/events`
const VENUE = 'Rockland County Chess Club'
const DEFAULT_ADDRESS = '70 Main St'
const CITY = 'Nyack'

interface Chess67Session {
  starts_at: string
  ends_at: string | null
}

/** One entry of `clubPageData.pageEvents` in the page's vike_pageContext JSON. */
export interface Chess67Event {
  title: string
  slug: string
  start_at: string // ISO instant with offset, e.g. "2026-11-20T00:00:00+00:00"
  end_at: string | null
  status: string // "scheduled" | "cancelled" | ...
  cancelled_at: string | null
  is_published: boolean
  is_listed: boolean
  description: string | null
  address: string | null
  image_url: string | null
  require_payment: boolean
  payment_mode: string // "disabled" | "required" | ...
  event_sessions: Chess67Session[] | null
}

/**
 * Pull `clubPageData.pageEvents` out of the Vike page-context JSON blob that
 * chess67.com server-renders into every page.
 */
export function extractChess67Events(html: string): Chess67Event[] {
  const match = html.match(
    /<script id="vike_pageContext" type="application\/json">([\s\S]*?)<\/script>/
  )
  if (!match) return []
  try {
    const ctx = JSON.parse(match[1])
    const events = ctx?.clubPageData?.pageEvents
    return Array.isArray(events) ? events : []
  } catch {
    return []
  }
}

/** "70 Main St - 70 Main St, Nyack, NY 10960, 3rd Floor" → "70 Main St" */
function streetAddress(raw: string | null): string {
  if (!raw) return DEFAULT_ADDRESS
  const street = raw.split(/\s+-\s+|,/)[0]?.trim()
  return street || DEFAULT_ADDRESS
}

/**
 * Turn chess67 events into ScrapedEvents. Timestamps on chess67 are true
 * instants (with offset), so they are used as-is — no Eastern-time
 * reconstruction. A multi-week class becomes one event per session.
 */
export function chess67ToScrapedEvents(raw: Chess67Event[], now: Date): ScrapedEvent[] {
  const events: ScrapedEvent[] = []

  for (const e of raw) {
    if (!e.title || !e.start_at) continue
    if (!e.is_published || !e.is_listed) continue
    if (e.cancelled_at || e.status === 'cancelled') continue

    const sessions: Chess67Session[] =
      e.event_sessions && e.event_sessions.length > 0
        ? e.event_sessions
        : [{ starts_at: e.start_at, ends_at: e.end_at }]

    const isClass = /class|lesson|camp/i.test(e.title)
    const isFree = !e.require_payment && e.payment_mode === 'disabled'

    for (const s of sessions) {
      const startDate = new Date(s.starts_at)
      if (isNaN(startDate.getTime()) || startDate <= now) continue
      const endDate = s.ends_at ? new Date(s.ends_at) : null

      events.push({
        title: e.title.trim(),
        description: e.description?.trim() || null,
        startDate,
        endDate: endDate && !isNaN(endDate.getTime()) ? endDate : null,
        venue: VENUE,
        address: streetAddress(e.address),
        city: CITY,
        isNyackProper: true,
        category: isClass ? Category.CLASSES_WORKSHOPS : Category.SPORTS_RECREATION,
        price: isFree ? 'Free' : null,
        isFree,
        isFamilyFriendly: guessFamilyFriendly(e.title, e.description),
        sourceUrl: `${CLUB_URL}/events/${e.slug}`,
        sourceName: SOURCE_NAME,
        imageUrl: e.image_url,
      })
    }
  }

  return events
}

/**
 * Scraper for Rockland County Chess Club (hosted on chess67.com).
 * Event data comes from the server-rendered vike_pageContext JSON.
 */
export const rocklandChessScraper: Scraper = {
  name: SOURCE_NAME,

  async scrape(): Promise<ScraperResult> {
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

      const rawEvents = extractChess67Events(await response.text())
      if (rawEvents.length === 0) {
        return {
          sourceName: SOURCE_NAME,
          events: [],
          status: 'error',
          errorMessage: 'No events found in chess67 page context (page format may have changed)',
        }
      }

      const events = chess67ToScrapedEvents(rawEvents, new Date())
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
      return {
        sourceName: SOURCE_NAME,
        events: [],
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  },
}
