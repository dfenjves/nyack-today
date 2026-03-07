import * as cheerio from 'cheerio'
import { Scraper, ScraperResult, ScrapedEvent } from './types'
import { extractJsonLdEvents, jsonLdToScrapedEvent, fetchWithTimeout } from './utils'

const SOURCE_NAME = 'Visit Nyack'
const CALENDAR_URL = 'https://visitnyack.org/calendar/'

/**
 * Extract event URLs from the calendar page
 */
function extractEventUrls(html: string): string[] {
  const $ = cheerio.load(html)
  const urls: string[] = []

  // Find all event links on the calendar
  $('a[href*="/event/"]').each((_, element) => {
    const href = $(element).attr('href')
    if (href && !href.includes('#') && !urls.includes(href)) {
      urls.push(href)
    }
  })

  return urls
}

/**
 * Check if an event page is part of a series and return the series URL
 */
function extractSeriesUrl(html: string): string | null {
  const $ = cheerio.load(html)

  // Look for "see all" or series link
  const seriesLink = $('a[href*="/series/"]').attr('href')
  return seriesLink || null
}

/**
 * Extract all event URLs from a series page
 */
function extractSeriesEventUrls(html: string): string[] {
  const $ = cheerio.load(html)
  const urls: string[] = []

  // Find all event links in the series
  $('a[href*="/event/"]').each((_, element) => {
    const href = $(element).attr('href')
    if (href && !href.includes('#') && !urls.includes(href)) {
      urls.push(href)
    }
  })

  return urls
}

/**
 * Scraper for visitnyack.org calendar
 * Uses The Events Calendar plugin which outputs JSON-LD structured data
 * Handles event series by scraping individual event pages
 */
export const visitNyackScraper: Scraper = {
  name: SOURCE_NAME,

  async scrape(): Promise<ScraperResult> {
    const events: ScrapedEvent[] = []
    const processedUrls = new Set<string>()
    const seriesUrls = new Set<string>()

    try {
      // Fetch the calendar page
      const response = await fetchWithTimeout(CALENDAR_URL)

      if (!response.ok) {
        return {
          sourceName: SOURCE_NAME,
          events: [],
          status: 'error',
          errorMessage: `HTTP ${response.status}: ${response.statusText}`,
        }
      }

      const html = await response.text()

      // Extract all event URLs from the calendar
      const eventUrls = extractEventUrls(html)

      console.log(`Found ${eventUrls.length} event URLs on calendar`)

      // Process each event URL
      for (const eventUrl of eventUrls) {
        if (processedUrls.has(eventUrl)) {
          continue
        }

        try {
          // Fetch the individual event page
          const eventResponse = await fetchWithTimeout(eventUrl, 8000)
          if (!eventResponse.ok) {
            console.log(`Failed to fetch ${eventUrl}: ${eventResponse.status}`)
            continue
          }

          const eventHtml = await eventResponse.text()

          // Check if this event is part of a series
          const seriesUrl = extractSeriesUrl(eventHtml)

          if (seriesUrl && !seriesUrls.has(seriesUrl)) {
            // This is part of a series - fetch the series page to get all dates
            console.log(`Found series: ${seriesUrl}`)
            seriesUrls.add(seriesUrl)

            try {
              const seriesResponse = await fetchWithTimeout(seriesUrl, 8000)
              if (seriesResponse.ok) {
                const seriesHtml = await seriesResponse.text()
                const seriesEventUrls = extractSeriesEventUrls(seriesHtml)

                console.log(`Series has ${seriesEventUrls.length} events`)

                // Process each event in the series
                for (const seriesEventUrl of seriesEventUrls) {
                  if (processedUrls.has(seriesEventUrl)) {
                    continue
                  }

                  try {
                    const seriesEventResponse = await fetchWithTimeout(seriesEventUrl, 8000)
                    if (seriesEventResponse.ok) {
                      const seriesEventHtml = await seriesEventResponse.text()
                      const jsonLdEvents = extractJsonLdEvents(seriesEventHtml)

                      for (const jsonLd of jsonLdEvents) {
                        const scraped = jsonLdToScrapedEvent(jsonLd, SOURCE_NAME, seriesEventUrl)
                        if (scraped) {
                          events.push(scraped)
                        }
                      }

                      processedUrls.add(seriesEventUrl)
                    }
                  } catch (error) {
                    console.log(`Error fetching series event ${seriesEventUrl}:`, error)
                  }

                  // Small delay to be polite
                  await new Promise(resolve => setTimeout(resolve, 500))
                }
              }
            } catch (error) {
              console.log(`Error fetching series ${seriesUrl}:`, error)
            }
          } else {
            // Single event, not part of a series
            const jsonLdEvents = extractJsonLdEvents(eventHtml)

            for (const jsonLd of jsonLdEvents) {
              const scraped = jsonLdToScrapedEvent(jsonLd, SOURCE_NAME, eventUrl)
              if (scraped) {
                events.push(scraped)
              }
            }
          }

          processedUrls.add(eventUrl)

          // Small delay between requests to be polite
          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (error) {
          console.log(`Error processing event ${eventUrl}:`, error)
        }
      }

      if (events.length === 0) {
        return {
          sourceName: SOURCE_NAME,
          events: [],
          status: 'partial',
          errorMessage: 'No events found',
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
