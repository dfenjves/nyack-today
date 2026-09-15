/**
 * Generic, config-driven source scraper.
 *
 * One `Source` row in the database describes a page (or feed): where it lives,
 * how to fetch it, and what defaults to apply. This module turns each enabled
 * Source into a `Scraper`, so every source gets its own `ScraperLog` rows and
 * its own line on /admin/pulse without a single bespoke scraper file.
 *
 * Fetch modes:
 *   CHEERIO   static HTML → readable text → AI extraction
 *   PUPPETEER JS-rendered page → readable text → AI extraction
 *   JSONLD    schema.org Event JSON-LD → structured, no AI (falls back to CHEERIO)
 *   ICAL      .ics feed → structured, no AI (recurrences expanded 60 days)
 *   RSS       feed items → AI extraction, batched
 *
 * Publishing: unless `autoPublish` is true, extracted events become PENDING
 * `EventSubmission` rows for review (the same path Discord and Instagram use)
 * rather than going straight into `Event`.
 */

import * as cheerio from 'cheerio'
import * as ical from 'node-ical'
import { Category, Source, SourceFetchMode } from '@prisma/client'
import { prisma } from '@/lib/db'
import { Scraper, ScrapedEvent, ScraperResult } from './types'
import {
  areEventsDuplicates,
  decodeHtmlEntities,
  guessFamilyFriendly,
  isInCoverageArea,
  makeEasternDate,
  parsePrice,
  stripHtml,
} from './utils'
import { guessCategory } from '@/lib/utils/categories'
import { extractEventsFromWebPage } from '@/lib/ai/client'
import { estimateTokenCount } from '@/lib/ai/prompts'
import { ExtractedEvent } from '@/lib/ai/types'

const TIMEZONE = 'America/New_York'

/** Vercel caps a function at 300 s and the daily run already has 17 scrapers. */
export const MAX_URLS_PER_SOURCE = 3
const FETCH_TIMEOUT_MS = 15_000
const PUPPETEER_TIMEOUT_MS = 20_000
const ROBOTS_TIMEOUT_MS = 5_000

/** Roughly 12k tokens of page text per AI call. */
const MAX_PROMPT_TOKENS = 12_000
const CHARS_PER_TOKEN = 4

/** Only the first N images are kept, so a gallery page can't eat the budget. */
const MAX_IMAGES = 10

/** Recurring VEVENTs are expanded this far ahead and no further. */
const ICAL_RECURRENCE_DAYS = 60

/** RSS items per AI call. */
const RSS_ITEMS_PER_BATCH = 8
const RSS_MAX_ITEMS = 40

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 NyackToday/1.0 (+https://nyacktoday.com)'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The subset of a `Source` the scraper actually needs. Kept separate from the
 * Prisma model so the admin "Test" endpoint can dry-run an unsaved form.
 */
export interface SourceConfig {
  name: string
  slug: string
  urls: string[]
  fetchMode: SourceFetchMode
  defaultVenue: string | null
  defaultAddress: string | null
  defaultCity: string
  isNyackProper: boolean
  defaultCategory: Category | null
  familyFriendlyHint: boolean | null
}

/** Per-URL diagnostics, surfaced by the admin Test button. */
export interface PageDiagnostics {
  url: string
  /** The mode actually used — JSONLD falls back to CHEERIO when no JSON-LD is found. */
  fetchMode: SourceFetchMode
  textLength: number
  estimatedTokens: number
  elapsedMs: number
  eventsFound: number
  truncated: boolean
}

export interface SourceExtraction {
  events: ScrapedEvent[]
  warnings: string[]
  pages: PageDiagnostics[]
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export function toSourceConfig(source: Source): SourceConfig {
  return {
    name: source.name,
    slug: source.slug,
    urls: source.urls,
    fetchMode: source.fetchMode,
    defaultVenue: source.defaultVenue,
    defaultAddress: source.defaultAddress,
    defaultCity: source.defaultCity,
    isNyackProper: source.isNyackProper,
    defaultCategory: source.defaultCategory,
    familyFriendlyHint: source.familyFriendlyHint,
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

function absoluteUrl(href: string | undefined, baseUrl: string): string | null {
  if (!href) return null
  const trimmed = href.trim()
  if (!trimmed || trimmed.startsWith('#') || /^(javascript|mailto|tel|data):/i.test(trimmed)) {
    return null
  }
  try {
    return new URL(trimmed, baseUrl).toString()
  } catch {
    return null
  }
}

const easternPartsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** Calendar/clock components of an instant as seen in Eastern time. */
function easternParts(date: Date): {
  year: number
  month: number // 0-indexed
  day: number
  hour: number
  minute: number
} {
  const parts = easternPartsFormat.formatToParts(date)
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10)
  return {
    year: get('year'),
    month: get('month') - 1,
    day: get('day'),
    hour: get('hour') % 24, // en-US hour12:false can emit "24" at midnight
    minute: get('minute'),
  }
}

/** Today's date in Eastern time, spelled out for the AI prompt. */
export function easternToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(now)
}

/**
 * Parse a date string returned by the AI.
 *
 * An ISO string with an explicit offset or Z is trusted as-is. A string with no
 * timezone is interpreted as Eastern (see TIMEZONE_FIX.md) rather than as the
 * server's local time, which on Vercel is UTC. A bare date with no time gets
 * 7 PM Eastern, matching the prompt's stated default.
 */
export function parseExtractedDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null

  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) {
    const parsed = new Date(trimmed)
    return isNaN(parsed.getTime()) ? null : parsed
  }

  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/)
  if (match) {
    const [, year, month, day, hour, minute] = match
    return makeEasternDate(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      hour === undefined ? 19 : parseInt(hour, 10),
      minute === undefined ? 0 : parseInt(minute, 10)
    )
  }

  const fallback = new Date(trimmed)
  return isNaN(fallback.getTime()) ? null : fallback
}

/**
 * Cities arrive from AI and feeds in many spellings ("Nyack, NY", "NYACK").
 * Normalize enough for isInCoverageArea's exact-match list.
 */
function normalizeCity(city: string | null | undefined, fallback: string): string {
  const raw = (city ?? '').trim()
  if (!raw) return fallback
  const cleaned = raw
    .replace(/\s*,\s*(NY|New York)\s*\d*$/i, '')
    .replace(/\s+\d{5}(-\d{4})?$/, '')
    .trim()
  return cleaned || fallback
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

// ---------------------------------------------------------------------------
// robots.txt
// ---------------------------------------------------------------------------

const robotsCache = new Map<string, string | null>()

async function fetchRobots(origin: string): Promise<string | null> {
  if (robotsCache.has(origin)) return robotsCache.get(origin) ?? null

  let body: string | null = null
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), ROBOTS_TIMEOUT_MS)
    try {
      const response = await fetch(`${origin}/robots.txt`, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT },
      })
      // A missing or server-errored robots.txt means "no rules", per convention.
      body = response.ok ? await response.text() : null
    } finally {
      clearTimeout(timer)
    }
  } catch {
    body = null
  }

  robotsCache.set(origin, body)
  return body
}

/**
 * Simple robots.txt check: the `User-agent: *` group only, longest matching
 * Allow/Disallow prefix wins. Enough to keep us off pages a site has asked
 * crawlers to leave alone; not a full RFC 9309 implementation.
 */
export async function isAllowedByRobots(url: string): Promise<{ allowed: boolean; rule?: string }> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { allowed: false, rule: 'invalid URL' }
  }

  const body = await fetchRobots(parsed.origin)
  if (!body) return { allowed: true }

  let inWildcardGroup = false
  let sawGroupStart = false
  const rules: { allow: boolean; path: string }[] = []

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim()
    if (!line) continue
    const separator = line.indexOf(':')
    if (separator === -1) continue

    const field = line.slice(0, separator).trim().toLowerCase()
    const value = line.slice(separator + 1).trim()

    if (field === 'user-agent') {
      // A new user-agent line after rules starts a fresh group.
      if (sawGroupStart) {
        inWildcardGroup = value === '*'
        sawGroupStart = false
      } else {
        inWildcardGroup = inWildcardGroup || value === '*'
      }
      continue
    }

    if (field !== 'allow' && field !== 'disallow') continue
    sawGroupStart = true
    if (!inWildcardGroup) continue
    if (field === 'disallow' && value === '') continue // "Disallow:" means allow all
    rules.push({ allow: field === 'allow', path: value })
  }

  const target = parsed.pathname + parsed.search
  let best: { allow: boolean; path: string } | null = null
  for (const rule of rules) {
    // Treat a trailing * as a plain prefix; ignore other wildcards.
    const prefix = rule.path.replace(/\*+$/, '')
    if (!target.startsWith(prefix)) continue
    if (!best || prefix.length > best.path.replace(/\*+$/, '').length) best = rule
  }

  if (best && !best.allow) {
    return { allowed: false, rule: `Disallow: ${best.path}` }
  }
  return { allowed: true }
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

async function fetchText(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/calendar;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    return await response.text()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Render a JS-heavy page and return its HTML.
 *
 * Browser setup mirrors the original Explore Rockland Puppeteer scraper
 * (@sparticuz/chromium on Vercel, a local Chrome otherwise). Imported lazily so
 * the common CHEERIO path never loads Chromium.
 */
async function fetchRenderedHtml(url: string): Promise<string> {
  const puppeteer = (await import('puppeteer-core')).default
  type BrowserLike = Awaited<ReturnType<typeof puppeteer.launch>>
  let browser: BrowserLike | null = null

  try {
    if (process.env.VERCEL_ENV) {
      const chromium = (await import('@sparticuz/chromium')).default
      const path = await import('path')

      if (!process.env.AWS_LAMBDA_JS_RUNTIME) {
        process.env.AWS_LAMBDA_JS_RUNTIME = 'nodejs22.x'
      }

      const executablePath = await chromium.executablePath()
      // CRITICAL: Chromium can't find its shared libraries without this.
      process.env.LD_LIBRARY_PATH = path.dirname(executablePath)

      browser = await puppeteer.launch({
        args: chromium.args,
        executablePath,
        headless: true,
      })
    } else {
      // Local development: reuse the Chrome the full `puppeteer` package manages.
      let executablePath = process.env.CHROME_BIN
      if (!executablePath) {
        const local = (await import('puppeteer')).default
        executablePath = local.executablePath()
      }
      browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath,
        headless: true,
      })
    }

    const page = await browser.newPage()
    await page.setUserAgent(USER_AGENT)
    await page.goto(url, { waitUntil: 'networkidle2', timeout: PUPPETEER_TIMEOUT_MS })
    return await page.content()
  } finally {
    await browser?.close().catch(() => undefined)
  }
}

// ---------------------------------------------------------------------------
// HTML → readable text
// ---------------------------------------------------------------------------

const BLOCK_SELECTOR =
  'p, div, section, article, li, tr, h1, h2, h3, h4, h5, h6, blockquote, dd, dt, td'

/**
 * Reduce a page to the text an extraction model can actually use: no chrome,
 * no styling, links kept inline as [text](url) so the model can return real
 * event URLs, and the first few images as ![alt](url) for imageUrl.
 */
export function htmlToReadableText(html: string, baseUrl: string): string {
  const $ = cheerio.load(html)

  $('script, style, nav, header, footer, noscript, svg, iframe, form, select, template').remove()

  let images = 0
  $('img').each((_, element) => {
    const $img = $(element)
    const src = absoluteUrl($img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy-src'), baseUrl)
    if (!src || images >= MAX_IMAGES) {
      $img.remove()
      return
    }
    images++
    const alt = ($img.attr('alt') || '').replace(/[\[\]()]/g, '').trim()
    $img.replaceWith(` ![${alt}](${src}) `)
  })

  $('a').each((_, element) => {
    const $a = $(element)
    const text = $a.text().replace(/\s+/g, ' ').trim()
    const href = absoluteUrl($a.attr('href'), baseUrl)
    if (!text) {
      $a.replaceWith(' ')
      return
    }
    $a.replaceWith(href ? ` [${text.replace(/[\[\]]/g, '')}](${href}) ` : ` ${text} `)
  })

  $('br').replaceWith('\n')
  $(BLOCK_SELECTOR).each((_, element) => {
    $(element).append('\n')
  })

  const text = $('body').length > 0 ? $('body').text() : $.root().text()
  return collapseWhitespace(decodeHtmlEntities(text))
}

function collapseWhitespace(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/[ \t ]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line, index, lines) => line !== '' || lines[index - 1] !== '')
    .join('\n')
    .trim()
}

const DATE_SIGNAL =
  /(\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b)|(\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b)|(\b(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*day\b)|(\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b)/gi

function countDateSignals(text: string): number {
  return (text.match(DATE_SIGNAL) ?? []).length
}

/**
 * Keep the page under the prompt budget. When it's too long, slide a window
 * over it and keep the stretch with the most date-like strings — on a long
 * venue page that is the calendar, not the "about us" copy.
 */
export function capToTokenBudget(
  text: string,
  maxTokens = MAX_PROMPT_TOKENS
): { text: string; truncated: boolean } {
  if (estimateTokenCount(text) <= maxTokens) {
    return { text, truncated: false }
  }

  const windowChars = maxTokens * CHARS_PER_TOKEN
  const step = Math.max(1, Math.floor(windowChars / 4))

  let bestStart = 0
  let bestScore = -1
  for (let start = 0; start < text.length; start += step) {
    const score = countDateSignals(text.slice(start, start + windowChars))
    if (score > bestScore) {
      bestScore = score
      bestStart = start
    }
    if (start + windowChars >= text.length) break
  }

  // Snap to line boundaries so we don't cut a listing in half.
  const snappedStart = bestStart === 0 ? 0 : text.indexOf('\n', bestStart) + 1 || bestStart
  const slice = text.slice(snappedStart, snappedStart + windowChars)
  const lastNewline = slice.lastIndexOf('\n')

  return {
    text: lastNewline > windowChars / 2 ? slice.slice(0, lastNewline) : slice,
    truncated: true,
  }
}

// ---------------------------------------------------------------------------
// ExtractedEvent → ScrapedEvent
// ---------------------------------------------------------------------------

/**
 * Map an AI-extracted event onto our ScrapedEvent shape, applying the source's
 * configured defaults. Returns null (with a reason) for anything unusable.
 */
export function toScrapedEvent(
  extracted: ExtractedEvent,
  config: SourceConfig,
  pageUrl: string,
  now: Date = new Date()
): { event: ScrapedEvent } | { event: null; reason: string } {
  const title = (extracted.title ?? '').trim()
  if (!title) return { event: null, reason: 'missing title' }

  const startDate = parseExtractedDate(extracted.startDate)
  if (!startDate) {
    return { event: null, reason: `"${truncate(title, 60)}" has an unparseable date` }
  }
  if (startDate < now) {
    return { event: null, reason: `"${truncate(title, 60)}" is in the past` }
  }

  const endDate = parseExtractedDate(extracted.endDate)

  const city = normalizeCity(extracted.city, config.defaultCity)
  if (!isInCoverageArea(city)) {
    return { event: null, reason: `"${truncate(title, 60)}" is in ${city}, outside the coverage area` }
  }

  // Feeds and JSON-LD often put a bare locality ("Nyack, NY, USA") where the
  // venue name belongs. That's not venue information, so prefer the source's
  // configured venue when we have one.
  const rawVenue = (extracted.venue ?? '').trim()
  const venueLooksLikeCity = isInCoverageArea(normalizeCity(rawVenue.replace(/,\s*USA$/i, ''), ''))
  const venue =
    (!rawVenue || venueLooksLikeCity ? config.defaultVenue : rawVenue) ||
    rawVenue ||
    config.defaultVenue ||
    config.name
  const description = extracted.description
    ? truncate(decodeHtmlEntities(stripHtml(extracted.description)).trim(), 1000) || null
    : null

  const { price, isFree } = parsePrice(extracted.price)

  // TODO: swap for categorizeEvent() from src/lib/ai/categorize.ts once
  // docs/prompts/recategorize-other.md ships, so sources without a configured
  // default get an AI category instead of keyword guessing.
  const category = config.defaultCategory ?? guessCategory(title, description)

  const eventUrl = absoluteUrl(extracted.eventUrl ?? undefined, pageUrl) ?? pageUrl
  const imageUrl = absoluteUrl(extracted.imageUrl ?? undefined, pageUrl)

  return {
    event: {
      title: decodeHtmlEntities(title),
      description,
      startDate,
      endDate: endDate && endDate > startDate ? endDate : null,
      venue,
      address: (extracted.address ?? '').trim() || config.defaultAddress,
      city,
      isNyackProper:
        city.toLowerCase() === config.defaultCity.toLowerCase()
          ? config.isNyackProper
          : ['nyack', 'south nyack', 'upper nyack'].includes(city.toLowerCase()),
      category,
      price,
      isFree,
      isFamilyFriendly: config.familyFriendlyHint ?? guessFamilyFriendly(title, description),
      sourceUrl: eventUrl,
      sourceName: config.name,
      imageUrl,
    },
  }
}

/** Drop events this run already produced (two URLs of one source often overlap). */
function dedupeWithinRun(events: ScrapedEvent[]): ScrapedEvent[] {
  const kept: ScrapedEvent[] = []
  for (const event of events) {
    const duplicate = kept.some((other) =>
      areEventsDuplicates(event.title, event.venue, event.startDate, other.title, other.venue, other.startDate)
    )
    if (!duplicate) kept.push(event)
  }
  return kept
}

// ---------------------------------------------------------------------------
// Fetch modes
// ---------------------------------------------------------------------------

interface PageResult {
  events: ScrapedEvent[]
  warnings: string[]
  page: PageDiagnostics
}

async function extractFromPageText(
  text: string,
  url: string,
  config: SourceConfig,
  mode: SourceFetchMode,
  startedAt: number,
  now: Date
): Promise<PageResult> {
  const warnings: string[] = []
  const capped = capToTokenBudget(text)
  if (capped.truncated) {
    warnings.push(
      `${url}: page text was ${estimateTokenCount(text)} est. tokens; kept the ${MAX_PROMPT_TOKENS}-token stretch with the most dates`
    )
  }

  if (!capped.text.trim()) {
    warnings.push(`${url}: no readable text after stripping the page`)
    return {
      events: [],
      warnings,
      page: {
        url,
        fetchMode: mode,
        textLength: 0,
        estimatedTokens: 0,
        elapsedMs: Date.now() - startedAt,
        eventsFound: 0,
        truncated: capped.truncated,
      },
    }
  }

  const response = await extractEventsFromWebPage({
    sourceName: config.name,
    url,
    text: capped.text,
    defaultVenue: config.defaultVenue,
    defaultAddress: config.defaultAddress,
    defaultCity: config.defaultCity,
    defaultCategory: config.defaultCategory,
    today: easternToday(now),
  })

  const events: ScrapedEvent[] = []
  for (const extracted of response.events) {
    const mapped = toScrapedEvent(extracted, config, url, now)
    if (mapped.event) events.push(mapped.event)
    else warnings.push(`${url}: skipped — ${mapped.reason}`)
  }

  return {
    events,
    warnings,
    page: {
      url,
      fetchMode: mode,
      textLength: capped.text.length,
      estimatedTokens: estimateTokenCount(capped.text),
      elapsedMs: Date.now() - startedAt,
      eventsFound: events.length,
      truncated: capped.truncated,
    },
  }
}

/** JSON-LD: schema.org Event objects, including @graph and ItemList wrappers. */
function collectJsonLdEvents(html: string): Record<string, unknown>[] {
  const $ = cheerio.load(html)
  const found: Record<string, unknown>[] = []

  const visit = (node: unknown, depth = 0) => {
    if (!node || depth > 6) return
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1)
      return
    }
    if (typeof node !== 'object') return

    const record = node as Record<string, unknown>
    const type = record['@type']
    const types = Array.isArray(type) ? type : [type]
    if (types.some((t) => typeof t === 'string' && t.endsWith('Event'))) {
      found.push(record)
    }
    for (const key of ['@graph', 'itemListElement', 'item', 'subEvent', 'event']) {
      if (record[key]) visit(record[key], depth + 1)
    }
  }

  $('script[type="application/ld+json"]').each((_, element) => {
    const content = $(element).html()
    if (!content) return
    try {
      visit(JSON.parse(content))
    } catch {
      // Malformed JSON-LD blocks are common; ignore them.
    }
  })

  return found
}

function jsonLdToExtracted(node: Record<string, unknown>): ExtractedEvent | null {
  const name = typeof node.name === 'string' ? node.name : null
  const startDate = typeof node.startDate === 'string' ? node.startDate : null
  if (!name || !startDate) return null

  const location = node.location as Record<string, unknown> | undefined
  const address = location?.address as Record<string, unknown> | undefined

  let price: string | null = null
  const offers = node.offers
  const firstOffer = (Array.isArray(offers) ? offers[0] : offers) as Record<string, unknown> | undefined
  if (firstOffer && (typeof firstOffer.price === 'string' || typeof firstOffer.price === 'number')) {
    price = String(firstOffer.price)
  }

  const image = node.image
  const imageValue = Array.isArray(image) ? image[0] : image
  const imageUrl =
    typeof imageValue === 'string'
      ? imageValue
      : typeof (imageValue as Record<string, unknown>)?.url === 'string'
        ? ((imageValue as Record<string, unknown>).url as string)
        : null

  return {
    title: name,
    description: typeof node.description === 'string' ? node.description : null,
    startDate,
    endDate: typeof node.endDate === 'string' ? node.endDate : null,
    venue: (typeof location?.name === 'string' ? location.name : '') || '',
    address: typeof address?.streetAddress === 'string' ? address.streetAddress : null,
    city: typeof address?.addressLocality === 'string' ? address.addressLocality : '',
    price,
    imageUrl,
    eventUrl: typeof node.url === 'string' ? node.url : null,
  }
}

/** ICAL: node-ical returns string fields as a string or a {val} object. */
function icalValue(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'val' in value) {
    return String((value as { val: unknown }).val)
  }
  return null
}

function icalToExtracted(
  component: ical.VEvent,
  startDate: Date,
  fallbackUrl: string
): ExtractedEvent | null {
  const title = icalValue(component.summary)?.trim()
  if (!title) return null

  const location = icalValue(component.location)?.trim() || ''
  const description = icalValue(component.description)?.trim() || null

  // "Venue Name, 123 Main St, Nyack, NY 10960" → venue / address / city
  const segments = location.split(',').map((part) => part.trim()).filter(Boolean)
  const venue = segments[0] ?? ''
  const city = segments.length >= 3 ? segments[segments.length - 2].replace(/\s+[A-Z]{2}$/, '').trim() : ''

  let endDate: string | null = null
  if (component.end instanceof Date && component.start instanceof Date) {
    const durationMs = component.end.getTime() - component.start.getTime()
    if (durationMs > 0) endDate = new Date(startDate.getTime() + durationMs).toISOString()
  }

  return {
    title,
    description,
    startDate: startDate.toISOString(),
    endDate,
    venue,
    address: location || null,
    city,
    price: null,
    imageUrl: icalValue(component.attach),
    eventUrl: typeof component.url === 'string' ? component.url : fallbackUrl,
  }
}

/**
 * Expand a VEVENT into concrete start times, recurrences included but capped at
 * ICAL_RECURRENCE_DAYS ahead. Each occurrence keeps the original event's
 * Eastern wall-clock time so a DST boundary can't shift a 7 PM show to 6 PM.
 */
function expandIcalStarts(component: ical.VEvent, now: Date): Date[] {
  const start = component.start instanceof Date ? component.start : null
  if (!start) return []

  const horizon = new Date(now.getTime() + ICAL_RECURRENCE_DAYS * 24 * 60 * 60 * 1000)
  const rrule = (component as unknown as { rrule?: { between?: (a: Date, b: Date, inc?: boolean) => Date[] } }).rrule

  if (!rrule?.between) {
    return start >= now && start <= horizon ? [start] : []
  }

  const wallClock = easternParts(start)
  const excluded = new Set(
    Object.values((component as unknown as { exdate?: Record<string, Date> }).exdate ?? {})
      .filter((d): d is Date => d instanceof Date)
      .map((d) => d.toISOString().slice(0, 10))
  )

  let occurrences: Date[] = []
  try {
    occurrences = rrule.between(now, horizon, true)
  } catch {
    return start >= now && start <= horizon ? [start] : []
  }

  return occurrences
    .filter((occurrence) => !excluded.has(occurrence.toISOString().slice(0, 10)))
    .map((occurrence) => {
      const day = easternParts(occurrence)
      return makeEasternDate(day.year, day.month, day.day, wallClock.hour, wallClock.minute)
    })
    .filter((date) => date >= now && date <= horizon)
    .slice(0, 200)
}

/** RSS/Atom: flatten items into text blocks the AI reads in batches. */
function parseFeedItems(xml: string, baseUrl: string): string[] {
  const $ = cheerio.load(xml, { xmlMode: true })
  const blocks: string[] = []

  $('item, entry').each((_, element) => {
    if (blocks.length >= RSS_MAX_ITEMS) return false
    const $item = $(element)
    const title = $item.find('title').first().text().trim()
    if (!title) return

    const link =
      $item.find('link').first().text().trim() ||
      $item.find('link').first().attr('href')?.trim() ||
      ''
    const published =
      $item.find('pubDate, published, updated, dc\\:date').first().text().trim() || ''
    const body = decodeHtmlEntities(
      stripHtml(
        $item.find('content\\:encoded, content, description, summary').first().text() || ''
      )
    )
      .replace(/\s+/g, ' ')
      .trim()

    blocks.push(
      [
        `Title: ${title}`,
        link ? `Link: ${absoluteUrl(link, baseUrl) ?? link}` : '',
        published ? `Published: ${published}` : '',
        body ? `Description: ${truncate(body, 2000)}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    )
  })

  return blocks
}

// ---------------------------------------------------------------------------
// Per-URL dispatch
// ---------------------------------------------------------------------------

async function scrapeUrl(url: string, config: SourceConfig, now: Date): Promise<PageResult> {
  const startedAt = Date.now()
  const emptyPage = (mode: SourceFetchMode): PageDiagnostics => ({
    url,
    fetchMode: mode,
    textLength: 0,
    estimatedTokens: 0,
    elapsedMs: Date.now() - startedAt,
    eventsFound: 0,
    truncated: false,
  })

  // Only page fetches are subject to robots.txt; a published feed URL the site
  // hands out is meant to be consumed, but we check those too for consistency.
  const robots = await isAllowedByRobots(url)
  if (!robots.allowed) {
    throw new Error(`robots.txt disallows ${url} (${robots.rule})`)
  }

  switch (config.fetchMode) {
    case SourceFetchMode.ICAL: {
      const ics = await fetchText(url)
      const calendar = ical.sync.parseICS(ics)
      const warnings: string[] = []
      const events: ScrapedEvent[] = []

      for (const component of Object.values(calendar)) {
        if (!component || component.type !== 'VEVENT') continue
        for (const start of expandIcalStarts(component as ical.VEvent, now)) {
          const extracted = icalToExtracted(component as ical.VEvent, start, url)
          if (!extracted) continue
          const mapped = toScrapedEvent(extracted, config, url, now)
          if (mapped.event) events.push(mapped.event)
          else warnings.push(`${url}: skipped — ${mapped.reason}`)
        }
      }

      return {
        events,
        warnings,
        page: { ...emptyPage(SourceFetchMode.ICAL), textLength: ics.length, eventsFound: events.length },
      }
    }

    case SourceFetchMode.RSS: {
      const xml = await fetchText(url)
      const items = parseFeedItems(xml, url)
      const warnings: string[] = []
      const events: ScrapedEvent[] = []

      if (items.length === 0) {
        warnings.push(`${url}: no <item>/<entry> elements found — is this really a feed?`)
        return { events, warnings, page: emptyPage(SourceFetchMode.RSS) }
      }

      let textLength = 0
      let estimatedTokens = 0
      for (let i = 0; i < items.length; i += RSS_ITEMS_PER_BATCH) {
        const batch = items.slice(i, i + RSS_ITEMS_PER_BATCH).join('\n\n---\n\n')
        const result = await extractFromPageText(batch, url, config, SourceFetchMode.RSS, startedAt, now)
        textLength += result.page.textLength
        estimatedTokens += result.page.estimatedTokens
        events.push(...result.events)
        warnings.push(...result.warnings)
      }

      warnings.unshift(`${url}: ${items.length} feed items in ${Math.ceil(items.length / RSS_ITEMS_PER_BATCH)} AI call(s)`)

      return {
        events,
        warnings,
        page: {
          ...emptyPage(SourceFetchMode.RSS),
          textLength,
          estimatedTokens,
          eventsFound: events.length,
        },
      }
    }

    case SourceFetchMode.JSONLD: {
      const html = await fetchText(url)
      const nodes = collectJsonLdEvents(html)

      if (nodes.length === 0) {
        // Fall back to the text + AI path rather than returning nothing.
        const text = htmlToReadableText(html, url)
        const result = await extractFromPageText(text, url, config, SourceFetchMode.CHEERIO, startedAt, now)
        return {
          ...result,
          warnings: [
            `${url}: no schema.org Event JSON-LD found; fell back to CHEERIO text extraction`,
            ...result.warnings,
          ],
        }
      }

      const warnings: string[] = []
      const events: ScrapedEvent[] = []
      for (const node of nodes) {
        const extracted = jsonLdToExtracted(node)
        if (!extracted) continue
        const mapped = toScrapedEvent(extracted, config, url, now)
        if (mapped.event) events.push(mapped.event)
        else warnings.push(`${url}: skipped — ${mapped.reason}`)
      }

      return {
        events,
        warnings,
        page: {
          ...emptyPage(SourceFetchMode.JSONLD),
          textLength: html.length,
          eventsFound: events.length,
        },
      }
    }

    case SourceFetchMode.PUPPETEER: {
      const html = await fetchRenderedHtml(url)
      const text = htmlToReadableText(html, url)
      return extractFromPageText(text, url, config, SourceFetchMode.PUPPETEER, startedAt, now)
    }

    case SourceFetchMode.CHEERIO:
    default: {
      const html = await fetchText(url)
      const text = htmlToReadableText(html, url)
      return extractFromPageText(text, url, config, SourceFetchMode.CHEERIO, startedAt, now)
    }
  }
}

/**
 * Fetch and extract every URL of a source. Never throws: a URL that fails
 * becomes a warning so one bad page can't lose the others.
 */
export async function extractEventsForSource(
  config: SourceConfig,
  now: Date = new Date()
): Promise<SourceExtraction> {
  const events: ScrapedEvent[] = []
  const warnings: string[] = []
  const pages: PageDiagnostics[] = []

  const urls = config.urls.filter((url) => url.trim()).slice(0, MAX_URLS_PER_SOURCE)
  if (config.urls.length > MAX_URLS_PER_SOURCE) {
    warnings.push(
      `Only the first ${MAX_URLS_PER_SOURCE} URLs are fetched per run (${config.urls.length} configured)`
    )
  }
  if (urls.length === 0) {
    warnings.push('Source has no URLs configured')
    return { events, warnings, pages }
  }

  for (const url of urls) {
    try {
      const result = await scrapeUrl(url.trim(), config, now)
      events.push(...result.events)
      warnings.push(...result.warnings)
      pages.push(result.page)
    } catch (error) {
      warnings.push(`${url}: ${errorMessage(error)}`)
      pages.push({
        url,
        fetchMode: config.fetchMode,
        textLength: 0,
        estimatedTokens: 0,
        elapsedMs: 0,
        eventsFound: 0,
        truncated: false,
      })
    }
  }

  return { events: dedupeWithinRun(events), warnings, pages }
}

// ---------------------------------------------------------------------------
// Review queue
// ---------------------------------------------------------------------------

/**
 * Turn extracted events into PENDING EventSubmission rows, skipping anything
 * that already exists as a pending submission or a live event (the same fuzzy
 * match saveEvent uses, so a generic source can't duplicate a bespoke scraper).
 */
export async function submitEventsForReview(
  events: ScrapedEvent[],
  config: SourceConfig
): Promise<{ created: number; duplicates: number }> {
  if (events.length === 0) return { created: 0, duplicates: 0 }

  const times = events.map((event) => event.startDate.getTime())
  const rangeStart = new Date(Math.min(...times))
  rangeStart.setHours(0, 0, 0, 0)
  const rangeEnd = new Date(Math.max(...times))
  rangeEnd.setHours(23, 59, 59, 999)

  const [pendingSubmissions, existingEvents] = await Promise.all([
    prisma.eventSubmission.findMany({
      where: { status: 'PENDING', startDate: { gte: rangeStart, lte: rangeEnd } },
      select: { title: true, venue: true, startDate: true },
    }),
    prisma.event.findMany({
      where: { startDate: { gte: rangeStart, lte: rangeEnd } },
      select: { title: true, venue: true, startDate: true },
    }),
  ])

  const seen = [...pendingSubmissions, ...existingEvents]
  let created = 0
  let duplicates = 0

  for (const event of events) {
    const isDuplicate = seen.some((other) =>
      areEventsDuplicates(
        event.title,
        event.venue,
        event.startDate,
        other.title,
        other.venue,
        other.startDate
      )
    )

    if (isDuplicate) {
      duplicates++
      continue
    }

    try {
      await prisma.eventSubmission.create({
        data: {
          title: event.title,
          description: event.description,
          startDate: event.startDate,
          endDate: event.endDate,
          venue: event.venue,
          address: event.address,
          city: event.city,
          category: event.category,
          price: event.price,
          isFree: event.isFree,
          isFamilyFriendly: event.isFamilyFriendly,
          sourceName: event.sourceName,
          sourceUrl: event.sourceUrl,
          imageUrl: event.imageUrl,
          submitterEmail: `source-${config.slug || slugify(config.name)}@nyack.today`,
          status: 'PENDING',
        },
      })
      created++
      // Later events in this run must also dedupe against what we just created.
      seen.push({ title: event.title, venue: event.venue, startDate: event.startDate })
    } catch (error) {
      console.error(`Error creating submission for "${event.title}":`, errorMessage(error))
    }
  }

  return { created, duplicates }
}

// ---------------------------------------------------------------------------
// Scraper construction
// ---------------------------------------------------------------------------

async function recordRun(
  sourceId: string,
  status: string,
  error: string | null
): Promise<void> {
  try {
    await prisma.source.update({
      where: { id: sourceId },
      data: { lastRunAt: new Date(), lastStatus: status, lastError: error },
    })
  } catch (updateError) {
    console.error('Error recording Source run:', errorMessage(updateError))
  }
}

/**
 * Build a `Scraper` for one Source row. Each returned scraper gets its own
 * ScraperLog rows (keyed by the source name) and its own /admin/pulse line.
 *
 * `scrape()` never throws — a failing source records its error and returns an
 * error result so one bad site can't kill the nightly run.
 */
export function makeSourceScraper(source: Source): Scraper {
  const config = toSourceConfig(source)

  return {
    name: source.name,

    async scrape(): Promise<ScraperResult> {
      try {
        const { events, warnings } = await extractEventsForSource(config)

        if (source.autoPublish) {
          const status = events.length === 0 && warnings.length > 0 ? 'partial' : 'success'
          await recordRun(source.id, status, warnings.join('; ') || null)
          return {
            sourceName: source.name,
            events,
            status,
            errorMessage: warnings.length > 0 ? warnings.join('; ') : undefined,
          }
        }

        // Review mode: events become submissions, so the orchestrator gets an
        // empty events array. eventsFound keeps the ScraperLog (and Pulse)
        // honest about how much this source actually produced.
        const { created, duplicates } = await submitEventsForReview(events, config)
        const summary = `${created} events sent to review (${duplicates} already known)`
        const status = events.length === 0 && warnings.length > 0 ? 'partial' : 'success'

        await recordRun(source.id, status, warnings.join('; ') || null)

        return {
          sourceName: source.name,
          events: [],
          eventsFound: events.length,
          status,
          errorMessage: warnings.length > 0 ? `${summary}; ${warnings.join('; ')}` : summary,
        }
      } catch (error) {
        const message = errorMessage(error)
        await recordRun(source.id, 'error', message)
        return {
          sourceName: source.name,
          events: [],
          status: 'error',
          errorMessage: message,
        }
      }
    },
  }
}

/**
 * Every enabled Source as a Scraper, loaded fresh on each call so a source
 * added through /admin/sources takes effect on the next run with no deploy.
 *
 * Returns [] if the Source table can't be read, so a database hiccup degrades
 * the nightly run to the static scrapers instead of failing it.
 */
export async function genericSourceScrapers(): Promise<Scraper[]> {
  try {
    const sources = await prisma.source.findMany({
      where: { enabled: true },
      orderBy: { name: 'asc' },
    })
    return sources.map(makeSourceScraper)
  } catch (error) {
    console.error('Failed to load generic sources:', errorMessage(error))
    return []
  }
}
