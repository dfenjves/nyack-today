/**
 * Shared validation for the /api/admin/sources routes.
 *
 * Kept out of the route files so create, update, and the unsaved-config dry run
 * all agree on what a valid Source looks like.
 */

import { Category, SourceFetchMode } from '@prisma/client'
import { SourceConfig, slugify } from '@/lib/scrapers/generic'

export interface SourceInput {
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
  autoPublish: boolean
  enabled: boolean
  notes: string | null
}

export class SourceValidationError extends Error {}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * Accepts either an array of URLs or a newline/comma separated string, which is
 * what the admin form's textarea produces.
 */
export function parseUrls(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value.map((entry) => String(entry))
    : typeof value === 'string'
      ? value.split(/[\n,]/)
      : []

  const urls: string[] = []
  for (const entry of raw) {
    const trimmed = entry.trim()
    if (!trimmed) continue
    let parsed: URL
    try {
      parsed = new URL(trimmed)
    } catch {
      throw new SourceValidationError(`"${trimmed}" is not a valid URL`)
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new SourceValidationError(`"${trimmed}" must be an http(s) URL`)
    }
    if (!urls.includes(parsed.toString())) urls.push(parsed.toString())
  }

  return urls
}

export function parseFetchMode(value: unknown, fallback: SourceFetchMode = SourceFetchMode.CHEERIO): SourceFetchMode {
  if (value === undefined || value === null || value === '') return fallback
  const upper = String(value).toUpperCase()
  if (!(upper in SourceFetchMode)) {
    throw new SourceValidationError(
      `Unknown fetch mode "${value}" — expected one of ${Object.keys(SourceFetchMode).join(', ')}`
    )
  }
  return upper as SourceFetchMode
}

export function parseCategory(value: unknown): Category | null {
  if (value === undefined || value === null || value === '' || value === 'AUTO') return null
  const upper = String(value).toUpperCase()
  if (!(upper in Category)) {
    throw new SourceValidationError(`Unknown category "${value}"`)
  }
  return upper as Category
}

/** Tri-state: true / false / null ("Auto — let the heuristic decide"). */
export function parseTriState(value: unknown): boolean | null {
  if (value === undefined || value === null || value === '' || value === 'auto') return null
  if (value === true || value === 'true' || value === 'yes') return true
  if (value === false || value === 'false' || value === 'no') return false
  throw new SourceValidationError(`Expected true, false, or null — got "${value}"`)
}

/**
 * Validate a full create payload. Slug is derived from the name unless one is
 * supplied explicitly.
 */
export function parseSourceInput(body: Record<string, unknown>): SourceInput {
  const name = asString(body.name)
  if (!name) throw new SourceValidationError('Name is required')

  const slug = asString(body.slug) ?? slugify(name)
  if (!slug) throw new SourceValidationError('Could not derive a slug from that name')

  const urls = parseUrls(body.urls)
  if (urls.length === 0) throw new SourceValidationError('At least one URL is required')

  return {
    name,
    slug,
    urls,
    fetchMode: parseFetchMode(body.fetchMode),
    defaultVenue: asString(body.defaultVenue),
    defaultAddress: asString(body.defaultAddress),
    defaultCity: asString(body.defaultCity) ?? 'Nyack',
    isNyackProper: body.isNyackProper === undefined ? true : Boolean(body.isNyackProper),
    defaultCategory: parseCategory(body.defaultCategory),
    familyFriendlyHint: parseTriState(body.familyFriendlyHint),
    autoPublish: Boolean(body.autoPublish),
    enabled: body.enabled === undefined ? true : Boolean(body.enabled),
    notes: asString(body.notes),
  }
}

/** A SourceConfig for a dry run of values that may never be saved. */
export function toDryRunConfig(body: Record<string, unknown>): SourceConfig {
  const name = asString(body.name) ?? 'Untitled source'
  const urls = parseUrls(body.urls)
  if (urls.length === 0) throw new SourceValidationError('At least one URL is required')

  return {
    name,
    slug: asString(body.slug) ?? slugify(name),
    urls,
    fetchMode: parseFetchMode(body.fetchMode),
    defaultVenue: asString(body.defaultVenue),
    defaultAddress: asString(body.defaultAddress),
    defaultCity: asString(body.defaultCity) ?? 'Nyack',
    isNyackProper: body.isNyackProper === undefined ? true : Boolean(body.isNyackProper),
    defaultCategory: parseCategory(body.defaultCategory),
    familyFriendlyHint: parseTriState(body.familyFriendlyHint),
  }
}
