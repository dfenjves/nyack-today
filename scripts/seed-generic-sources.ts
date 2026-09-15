/**
 * Seed the first batch of generic scraper sources.
 *
 *   npx tsx scripts/seed-generic-sources.ts
 *
 * Idempotent: a source that already exists is left alone (edit it at
 * /admin/sources instead). Every source is created with autoPublish = false, so
 * its events land in /admin/submissions for review rather than going live.
 *
 * Sources whose sites turned out to have nothing scrapeable are created
 * DISABLED with a note saying why, so they're visible and easy to revisit
 * without costing the nightly run anything.
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })

import { Category, PrismaClient, SourceFetchMode } from '@prisma/client'
import { slugify } from '../src/lib/scrapers/generic'

const prisma = new PrismaClient()

interface Seed {
  name: string
  urls: string[]
  fetchMode: SourceFetchMode
  defaultVenue?: string
  defaultAddress?: string
  defaultCity?: string
  isNyackProper?: boolean
  defaultCategory?: Category
  familyFriendlyHint?: boolean
  enabled?: boolean
  notes?: string
}

const SEEDS: Seed[] = [
  {
    name: 'Nyack Library',
    urls: ['https://www.nyacklibrary.org/eventscalendar.html'],
    fetchMode: SourceFetchMode.PUPPETEER,
    defaultVenue: 'Nyack Library',
    defaultAddress: '59 S Broadway',
    notes:
      'LocalHop widget renders in an iframe — PUPPETEER only (its Parse API at api.getlocalhop.com needs an app-id header, and there is no public .ics). Shows the current month, so coverage rolls forward daily.',
  },
  {
    name: 'Nyack Center',
    urls: ['https://nyackcenter.org/upcoming-events'],
    fetchMode: SourceFetchMode.CHEERIO,
    defaultVenue: 'Nyack Center',
    defaultAddress: '58 Depew Ave',
    notes: 'Squarespace; events are in the static HTML.',
  },
  {
    name: 'Edward Hopper House',
    urls: ['https://www.edwardhopperhouse.org/calendar.html'],
    fetchMode: SourceFetchMode.PUPPETEER,
    defaultVenue: 'Edward Hopper House Museum & Study Center',
    defaultAddress: '82 N Broadway',
    defaultCategory: Category.ART_GALLERIES,
    notes:
      'Weebly site; the calendar content only appears after render. CHEERIO returns the nav and nothing else.',
  },
  {
    name: 'Nyack Chamber of Commerce',
    urls: ['https://www.nyackchamber.org/'],
    fetchMode: SourceFetchMode.CHEERIO,
    defaultVenue: 'Downtown Nyack',
    defaultCategory: Category.COMMUNITY_GOVERNMENT,
    notes:
      'No dedicated calendar page — the homepage lists the Farmers Market, Halloween Parade, and Holiday Lights.',
  },
  {
    name: 'Creative Arts Workshop',
    urls: ['https://www.arts-workshop.com/'],
    fetchMode: SourceFetchMode.CHEERIO,
    defaultVenue: 'Creative Arts Workshop',
    defaultAddress: '171 Main St',
    defaultCategory: Category.CLASSES_WORKSHOPS,
    familyFriendlyHint: true,
    notes: 'Wix site; one-off events appear on the homepage, classes are in a booking widget.',
  },
  {
    name: 'Big Red Books',
    urls: ['https://www.bigredbooks.net/'],
    fetchMode: SourceFetchMode.CHEERIO,
    defaultVenue: 'Big Red Books',
    defaultAddress: '120 Main St',
    enabled: false,
    notes:
      'DISABLED: the site is a Shopify storefront with no events page (/pages/events 404s, sitemap is products only). They announce readings on Instagram — add @bigredbooks to INSTAGRAM_HANDLES instead.',
  },
  {
    name: 'Homebody Books',
    urls: ['https://www.homebodybooks.net/events-1-1'],
    fetchMode: SourceFetchMode.CHEERIO,
    defaultVenue: 'Homebody Books',
    defaultAddress: '6 Park St',
    defaultCategory: Category.FAMILY_KIDS,
    familyFriendlyHint: true,
    enabled: false,
    notes:
      'DISABLED: the Squarespace events page still holds unedited demo content ("Event Five", January 2026 placeholders). Re-enable once they start using it; the page shape is fine.',
  },
  {
    name: 'Helen Hayes Youth Theatre',
    urls: ['https://helenhayesyouththeatre.com/'],
    fetchMode: SourceFetchMode.CHEERIO,
    defaultVenue: 'Helen Hayes Youth Theatre',
    defaultAddress: '142 Main St',
    defaultCategory: Category.THEATER,
    familyFriendlyHint: true,
    enabled: false,
    notes:
      'DISABLED: no dated listings on the site — performance dates live in the Arts People ticketing app (app.arts-people.com/index.php?ticketing=hhy01), which returns no readable text even rendered. Needs a bespoke approach or hand entry.',
  },
]

async function main() {
  for (const seed of SEEDS) {
    const slug = slugify(seed.name)
    const existing = await prisma.source.findFirst({
      where: { OR: [{ name: seed.name }, { slug }] },
    })

    if (existing) {
      console.log(`= ${seed.name} already exists (${existing.enabled ? 'enabled' : 'disabled'}), leaving as is`)
      continue
    }

    const source = await prisma.source.create({
      data: {
        name: seed.name,
        slug,
        urls: seed.urls,
        fetchMode: seed.fetchMode,
        defaultVenue: seed.defaultVenue ?? null,
        defaultAddress: seed.defaultAddress ?? null,
        defaultCity: seed.defaultCity ?? 'Nyack',
        isNyackProper: seed.isNyackProper ?? true,
        defaultCategory: seed.defaultCategory ?? null,
        familyFriendlyHint: seed.familyFriendlyHint ?? null,
        // Every seeded source starts in review mode. Flipping to auto-publish
        // is a human decision made on /admin/sources after a few clean runs.
        autoPublish: false,
        enabled: seed.enabled ?? true,
        notes: seed.notes ?? null,
      },
    })

    console.log(
      `+ ${source.name} — ${source.fetchMode}, ${source.enabled ? 'enabled' : 'DISABLED'}, review mode`
    )
  }

  const [total, enabled] = await Promise.all([
    prisma.source.count(),
    prisma.source.count({ where: { enabled: true } }),
  ])
  console.log(`\n${total} sources configured, ${enabled} enabled.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
