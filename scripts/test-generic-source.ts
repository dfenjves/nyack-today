/**
 * Dry-run the generic source scraper against a URL, without writing anything.
 *
 * The same code path as the admin Test button (POST /api/admin/sources/test),
 * but usable from a terminal while onboarding a source.
 *
 *   npx tsx scripts/test-generic-source.ts \
 *     --url=https://www.nyackcenter.org/events \
 *     --mode=CHEERIO \
 *     --name="Nyack Center" \
 *     --venue="Nyack Center" \
 *     --city=Nyack
 *
 * --mode is one of CHEERIO | PUPPETEER | ICAL | RSS | JSONLD (default CHEERIO).
 * --url may be repeated for multi-page sources.
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })

import { Category, SourceFetchMode } from '@prisma/client'
import { extractEventsForSource, slugify, SourceConfig } from '../src/lib/scrapers/generic'

function argValues(flag: string): string[] {
  return process.argv
    .filter((arg) => arg.startsWith(`--${flag}=`))
    .map((arg) => arg.slice(flag.length + 3))
}

function argValue(flag: string): string | undefined {
  return argValues(flag)[0]
}

const easternFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
})

async function main() {
  const urls = argValues('url')
  if (urls.length === 0) {
    console.error('Usage: npx tsx scripts/test-generic-source.ts --url=<url> [--mode=CHEERIO] [--name=..] [--venue=..] [--city=..] [--category=..]')
    process.exit(1)
  }

  const name = argValue('name') || new URL(urls[0]).hostname
  const categoryArg = argValue('category')

  const config: SourceConfig = {
    name,
    slug: slugify(name),
    urls,
    fetchMode: (argValue('mode') || 'CHEERIO').toUpperCase() as SourceFetchMode,
    defaultVenue: argValue('venue') || null,
    defaultAddress: argValue('address') || null,
    defaultCity: argValue('city') || 'Nyack',
    isNyackProper: argValue('nyackProper') !== 'false',
    defaultCategory: categoryArg ? (categoryArg as Category) : null,
    familyFriendlyHint: null,
  }

  console.log(`\n=== ${config.name} (${config.fetchMode}) ===`)
  const startedAt = Date.now()
  const result = await extractEventsForSource(config)
  const elapsed = Date.now() - startedAt

  for (const page of result.pages) {
    console.log(
      `  page ${page.url}\n    mode=${page.fetchMode} textLength=${page.textLength} ~tokens=${page.estimatedTokens} truncated=${page.truncated} elapsed=${page.elapsedMs}ms events=${page.eventsFound}`
    )
  }

  console.log(`\n  ${result.events.length} events in ${elapsed}ms`)
  for (const event of result.events) {
    console.log(
      `   • ${event.title}\n     ${easternFormat.format(event.startDate)} | ${event.venue}, ${event.city} | ${event.price ?? (event.isFree ? 'Free' : '—')} | ${event.category}\n     ${event.sourceUrl}`
    )
  }

  if (result.warnings.length > 0) {
    console.log('\n  warnings:')
    for (const warning of result.warnings) console.log(`   ! ${warning}`)
  }
  console.log('')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
