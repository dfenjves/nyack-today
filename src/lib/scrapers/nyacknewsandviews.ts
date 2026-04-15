import * as cheerio from 'cheerio'
import { Scraper, ScraperResult, ScrapedEvent } from './types'
import {
  fetchWithTimeout,
  parsePrice,
  guessFamilyFriendly,
  stripHtml,
  decodeHtmlEntities,
  makeEasternDate,
} from './utils'
import { guessCategory } from '@/lib/utils/categories'

const SOURCE_NAME = 'Nyack News and Views'
const CATEGORY_URL = 'https://nyacknewsandviews.com/blog/category/nyack-weekender/'
const BASE_URL = 'https://nyacknewsandviews.com'

const MONTH_MAP: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

/**
 * Parse a date+time string found in weekender post text.
 * Handles patterns like:
 *   "Friday, April 18 at 7pm"
 *   "Saturday April 19, 2pm-4pm"
 *   "April 18 at 7:30 p.m."
 *   "Friday at 7pm" (weekday only — resolved against postDate)
 *
 * Returns a Date or null.
 */
function parseDateFromText(text: string, postDate: Date): Date | null {
  const t = text.replace(/\./g, '').toLowerCase()

  // Full date: optional weekday, Month Day, optional time
  const fullMatch = t.match(
    /(?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)[,\s]+)?(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:[,\s]+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm))?/
  )
  if (fullMatch) {
    const monthStr = fullMatch[1].toLowerCase()
    const monthIndex = MONTH_MAP[monthStr]
    if (monthIndex !== undefined) {
      const day = parseInt(fullMatch[2], 10)
      let hour = 12
      let minute = 0
      if (fullMatch[5]) {
        hour = parseInt(fullMatch[3], 10)
        minute = fullMatch[4] ? parseInt(fullMatch[4], 10) : 0
        if (fullMatch[5] === 'pm' && hour !== 12) hour += 12
        if (fullMatch[5] === 'am' && hour === 12) hour = 0
      }

      // Infer year using post date as context
      let year = postDate.getFullYear()
      const candidate = makeEasternDate(year, monthIndex, day, hour, minute)
      // If candidate is more than 60 days before post date, bump to next year
      const sixtyDaysBefore = new Date(postDate.getTime() - 60 * 24 * 60 * 60 * 1000)
      if (candidate < sixtyDaysBefore) {
        year += 1
        return makeEasternDate(year, monthIndex, day, hour, minute)
      }
      return candidate
    }
  }

  // Weekday only: "Friday at 7pm" — resolve against the week of postDate
  const weekdayMatch = t.match(
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b(?:[,\s]+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm))?/
  )
  if (weekdayMatch) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const targetDay = dayNames.indexOf(weekdayMatch[1])
    if (targetDay >= 0) {
      const base = new Date(postDate)
      const diff = (targetDay - base.getDay() + 7) % 7
      base.setDate(base.getDate() + diff)

      let hour = 12
      let minute = 0
      if (weekdayMatch[4]) {
        hour = parseInt(weekdayMatch[2], 10)
        minute = weekdayMatch[3] ? parseInt(weekdayMatch[3], 10) : 0
        if (weekdayMatch[4] === 'pm' && hour !== 12) hour += 12
        if (weekdayMatch[4] === 'am' && hour === 12) hour = 0
      }
      return makeEasternDate(
        base.getFullYear(),
        base.getMonth(),
        base.getDate(),
        hour,
        minute
      )
    }
  }

  return null
}

/**
 * Extract the URL of the most recent weekender post from the category archive page.
 */
function extractLatestPostUrl(html: string): string | null {
  const $ = cheerio.load(html)

  // WordPress category pages typically list posts with article or .post elements
  // Try several common selectors for the first article link
  const selectors = [
    'article h2.entry-title a',
    'article h1.entry-title a',
    '.entry-title a',
    '.post-title a',
    'h2.post-title a',
    'h2 a',
    '.post a[rel="bookmark"]',
    'a[rel="bookmark"]',
  ]

  for (const sel of selectors) {
    const href = $(sel).first().attr('href')
    if (href) {
      return href.startsWith('http') ? href : `${BASE_URL}${href}`
    }
  }

  return null
}

/**
 * Parse the post publication date from the HTML.
 */
function extractPostDate(html: string): Date | null {
  const $ = cheerio.load(html)

  // Try common WordPress date meta selectors
  const selectors = [
    'time[datetime]',
    'meta[property="article:published_time"]',
    '.entry-date',
    '.published',
    '.post-date',
  ]

  for (const sel of selectors) {
    const el = $(sel).first()
    const dt = el.attr('datetime') || el.attr('content') || el.text().trim()
    if (dt) {
      const d = new Date(dt)
      if (!isNaN(d.getTime())) return d
    }
  }

  return null
}

/**
 * Extract the weekend date range from the post title, e.g. "April 18-20".
 * Returns [start, end] Dates or null.
 */
function extractWeekendRange(title: string, postDate: Date): [Date, Date] | null {
  // Match "Month Day1-Day2" or "Month Day1 – Day2"
  const match = title.match(
    /(\w+)\s+(\d{1,2})\s*[-–]\s*(\d{1,2})/i
  )
  if (match) {
    const monthStr = match[1].toLowerCase()
    const monthIndex = MONTH_MAP[monthStr]
    if (monthIndex !== undefined) {
      let year = postDate.getFullYear()
      const start = makeEasternDate(year, monthIndex, parseInt(match[2], 10), 12, 0)
      // If start is far in the past, use next year
      if (start < new Date(postDate.getTime() - 60 * 24 * 60 * 60 * 1000)) {
        year += 1
      }
      const end = makeEasternDate(year, monthIndex, parseInt(match[3], 10), 23, 59)
      return [start, end]
    }
  }
  return null
}

interface ParsedEvent {
  title: string
  description: string | null
  startDate: Date
  price: string | null
  isFree: boolean
  imageUrl: string | null
  sourceUrl: string
}

/**
 * Parse events from a weekender blog post.
 * Weekender posts typically list events as paragraphs with bold titles, dates, and descriptions.
 */
function parseWeekenderPost(html: string, postUrl: string, postDate: Date): ParsedEvent[] {
  const $ = cheerio.load(html)
  const events: ParsedEvent[] = []
  const now = new Date()

  // Determine the weekend range for fallback dates
  const postTitle = $('h1.entry-title, h1.post-title, h1').first().text().trim()
  const weekendRange = extractWeekendRange(postTitle, postDate)

  // Try to find the post content container
  const contentSelectors = [
    '.entry-content',
    '.post-content',
    '.article-content',
    '.content-area',
    'article .content',
    'article',
  ]

  const contentSelector = contentSelectors.find(sel => $(sel).length > 0) ?? 'body'
  const $content = $(contentSelector)

  // Strategy 1: Each event is headed by an <h2> or <h3>
  // Collect elements between headings as event details
  const headings = $content.find('h2, h3').toArray()
  if (headings.length >= 2) {
    for (const heading of headings) {
      const $heading = $(heading)
      const titleText = decodeHtmlEntities($heading.text().trim())

      // Skip headings that look like section headers rather than event titles
      if (!titleText || titleText.length < 3) continue
      if (/^(nyack weekender|weekend|events|what'?s\s+on|highlights)/i.test(titleText)) continue

      // Gather the sibling paragraphs until the next heading
      let combinedText = ''
      let $el = $heading.next()
      while ($el.length && !$el.is('h2, h3, h4')) {
        combinedText += ' ' + $el.text()
        $el = $el.next()
      }
      combinedText = combinedText.trim()

      // Try to find a date in the heading or following text
      const dateSource = titleText + ' ' + combinedText
      const startDate = parseDateFromText(dateSource, postDate)
        || (weekendRange ? weekendRange[0] : null)
      if (!startDate || startDate < now) continue

      // Extract price
      const { price, isFree } = parsePrice(
        combinedText.match(/\$[\d,]+(?:\.\d{2})?|\bfree\b/i)?.[0] ?? null
      )

      events.push({
        title: titleText,
        description: combinedText || null,
        startDate,
        price,
        isFree,
        imageUrl: null,
        sourceUrl: postUrl,
      })
    }
  }

  // Strategy 2: Each event is a paragraph with a <strong> or <b> title
  // Used when headings strategy yields nothing
  if (events.length === 0) {
    $content.find('p').each((_, el) => {
      const $p = $(el)

      // Look for a bold/strong element at the start of the paragraph
      const $bold = $p.find('strong, b').first()
      if (!$bold.length) return

      const titleText = decodeHtmlEntities($bold.text().trim())
      if (!titleText || titleText.length < 3) return

      // Full paragraph text for date/price extraction
      const fullText = decodeHtmlEntities(stripHtml($p.html() || '')).trim()

      const startDate = parseDateFromText(fullText, postDate)
        || (weekendRange ? weekendRange[0] : null)
      if (!startDate || startDate < now) return

      const { price, isFree } = parsePrice(
        fullText.match(/\$[\d,]+(?:\.\d{2})?|\bfree\b/i)?.[0] ?? null
      )

      // Description is everything after the bold title
      const descHtml = $p.html() || ''
      const afterBold = descHtml.replace(/<(?:strong|b)[^>]*>.*?<\/(?:strong|b)>/i, '').trim()
      const description = decodeHtmlEntities(stripHtml(afterBold)).replace(/^[:\s–-]+/, '').trim() || null

      events.push({
        title: titleText,
        description,
        startDate,
        price,
        isFree,
        imageUrl: null,
        sourceUrl: postUrl,
      })
    })
  }

  // Strategy 3: fallback — treat each list item as a potential event
  if (events.length === 0) {
    $content.find('li').each((_, el) => {
      const text = decodeHtmlEntities($(el).text().trim())
      if (!text || text.length < 10) return

      const startDate = parseDateFromText(text, postDate)
        || (weekendRange ? weekendRange[0] : null)
      if (!startDate || startDate < now) return

      // Use first sentence as title
      const sentences = text.split(/[.!?]/)
      const title = sentences[0].trim()
      if (!title || title.length < 3) return

      const { price, isFree } = parsePrice(
        text.match(/\$[\d,]+(?:\.\d{2})?|\bfree\b/i)?.[0] ?? null
      )

      events.push({
        title,
        description: text,
        startDate,
        price,
        isFree,
        imageUrl: null,
        sourceUrl: postUrl,
      })
    })
  }

  // Deduplicate by title
  const seen = new Set<string>()
  return events.filter(e => {
    const key = e.title.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Scraper for Nyack News and Views Weekender
 * Fetches the most recent weekender post and extracts events from the content.
 * Classified as Tier 3 (unstructured blog post parsing).
 */
export const nyackNewsAndViewsScraper: Scraper = {
  name: SOURCE_NAME,

  async scrape(): Promise<ScraperResult> {
    const events: ScrapedEvent[] = []

    try {
      // Step 1: Fetch the weekender category page
      const categoryResponse = await fetchWithTimeout(CATEGORY_URL, 15000)
      if (!categoryResponse.ok) {
        return {
          sourceName: SOURCE_NAME,
          events: [],
          status: 'error',
          errorMessage: `HTTP ${categoryResponse.status} fetching category page`,
        }
      }

      const categoryHtml = await categoryResponse.text()
      const latestPostUrl = extractLatestPostUrl(categoryHtml)

      if (!latestPostUrl) {
        return {
          sourceName: SOURCE_NAME,
          events: [],
          status: 'error',
          errorMessage: 'Could not find latest weekender post URL on category page',
        }
      }

      console.log(`[${SOURCE_NAME}] Latest post: ${latestPostUrl}`)

      // Step 2: Fetch the most recent weekender post
      const postResponse = await fetchWithTimeout(latestPostUrl, 15000)
      if (!postResponse.ok) {
        return {
          sourceName: SOURCE_NAME,
          events: [],
          status: 'error',
          errorMessage: `HTTP ${postResponse.status} fetching post ${latestPostUrl}`,
        }
      }

      const postHtml = await postResponse.text()

      // Step 3: Determine post date (used for date inference)
      const postDate = extractPostDate(postHtml) || new Date()
      console.log(`[${SOURCE_NAME}] Post date: ${postDate.toISOString()}`)

      // Step 4: Parse events from the post content
      const parsedEvents = parseWeekenderPost(postHtml, latestPostUrl, postDate)
      console.log(`[${SOURCE_NAME}] Parsed ${parsedEvents.length} events from post`)

      for (const parsed of parsedEvents) {
        const scrapedEvent: ScrapedEvent = {
          title: parsed.title,
          description: parsed.description,
          startDate: parsed.startDate,
          endDate: null,
          venue: 'Nyack',
          address: null,
          city: 'Nyack',
          isNyackProper: true,
          category: guessCategory(parsed.title, parsed.description),
          price: parsed.price,
          isFree: parsed.isFree,
          isFamilyFriendly: guessFamilyFriendly(parsed.title, parsed.description),
          sourceUrl: parsed.sourceUrl,
          sourceName: SOURCE_NAME,
          imageUrl: parsed.imageUrl,
        }

        events.push(scrapedEvent)
      }

      if (events.length === 0) {
        return {
          sourceName: SOURCE_NAME,
          events: [],
          status: 'partial',
          errorMessage: 'No upcoming events found in the latest weekender post',
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
