/**
 * One-off backfill: re-categorize events with AI.
 *
 * Default scope: non-hidden, upcoming events currently filed under OTHER.
 * `--all` widens to every non-hidden upcoming event (a full re-audit); that
 * mode reports only, unless `--apply-all` is also passed.
 *
 * Needs DATABASE_URL (and the AI provider key) from `.env.local`, which this
 * script loads with dotenv the same way `scripts/apply-discord-migration.ts`
 * does.
 *
 * Run:
 *   npx tsx scripts/recategorize-other.ts --dry-run
 *   npx tsx scripts/recategorize-other.ts
 *   npx tsx scripts/recategorize-other.ts --all --dry-run
 *   npx tsx scripts/recategorize-other.ts --all --apply-all
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient, Category } from '@prisma/client'
import {
  categorizeEvents,
  CATEGORIZE_BATCH_SIZE,
  type CategorizeResult,
} from '../src/lib/ai/categorize'

const prisma = new PrismaClient()

const DELAY_BETWEEN_BATCHES_MS = 500

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const all = args.includes('--all')
const applyAll = args.includes('--apply-all')

/** `--all` is report-only unless `--apply-all` is passed too. */
const willWrite = !dryRun && (!all || applyAll)

function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value
}

function pct(part: number, whole: number): string {
  if (whole === 0) return '0%'
  return `${((part / whole) * 100).toFixed(1)}%`
}

async function countOtherShare(): Promise<{
  other: number
  total: number
}> {
  const now = new Date()
  const where = { isHidden: false, startDate: { gte: now } }
  const [other, total] = await Promise.all([
    prisma.event.count({ where: { ...where, category: Category.OTHER } }),
    prisma.event.count({ where }),
  ])
  return { other, total }
}

async function main() {
  const now = new Date()

  const events = await prisma.event.findMany({
    where: {
      isHidden: false,
      startDate: { gte: now },
      ...(all ? {} : { category: Category.OTHER }),
    },
    select: {
      id: true,
      title: true,
      description: true,
      venue: true,
      sourceName: true,
      category: true,
      isFamilyFriendly: true,
      startDate: true,
    },
    orderBy: { startDate: 'asc' },
  })

  const before = await countOtherShare()

  console.log(
    `Scope: ${all ? 'ALL non-hidden upcoming events' : 'non-hidden upcoming events with category = OTHER'}`
  )
  console.log(`Mode:  ${dryRun ? 'DRY RUN (no writes)' : willWrite ? 'APPLY' : 'REPORT ONLY (pass --apply-all to write)'}`)
  console.log(
    `Before: ${before.other} of ${before.total} upcoming events are OTHER (${pct(before.other, before.total)})`
  )
  console.log(`Classifying ${events.length} event(s)...\n`)

  if (events.length === 0) {
    console.log('Nothing to do.')
    return
  }

  // Classify in batches with a short delay between them.
  const results: CategorizeResult[] = []
  for (let i = 0; i < events.length; i += CATEGORIZE_BATCH_SIZE) {
    const chunk = events.slice(i, i + CATEGORIZE_BATCH_SIZE)
    process.stdout.write(
      `  batch ${Math.floor(i / CATEGORIZE_BATCH_SIZE) + 1}/${Math.ceil(events.length / CATEGORIZE_BATCH_SIZE)} (${chunk.length} events)...`
    )
    const batchResults = await categorizeEvents(
      chunk.map((e) => ({
        title: e.title,
        description: e.description,
        venue: e.venue,
        sourceName: e.sourceName,
      }))
    )
    results.push(...batchResults)
    process.stdout.write(' done\n')
    if (i + CATEGORIZE_BATCH_SIZE < events.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS))
    }
  }

  // Build the proposal table
  const proposals = events.map((event, i) => {
    const result = results[i]
    const categoryChanged = result.category !== event.category
    const familyChanged =
      !event.isFamilyFriendly &&
      result.isFamilyFriendly === true &&
      result.confidence === 'high'
    return { event, result, categoryChanged, familyChanged }
  })

  const changed = proposals.filter((p) => p.categoryChanged || p.familyChanged)

  console.log(
    `\n${'ID'.padEnd(27)} ${'TITLE'.padEnd(40)} ${'VENUE'.padEnd(26)} ${'CURRENT → PROPOSED'.padEnd(44)} CONF  FAM`
  )
  console.log('-'.repeat(155))
  for (const { event, result, categoryChanged, familyChanged } of proposals) {
    const transition = categoryChanged
      ? `${event.category} → ${result.category}`
      : `${event.category} (no change)`
    console.log(
      `${event.id.padEnd(27)} ${truncate(event.title, 40).padEnd(40)} ${truncate(event.venue, 26).padEnd(26)} ${transition.padEnd(44)} ${result.confidence.padEnd(6)}${familyChanged ? 'false → true' : ''}`
    )
  }

  const byConfidence = {
    high: changed.filter((p) => p.result.confidence === 'high'),
    medium: changed.filter((p) => p.result.confidence === 'medium'),
    low: changed.filter((p) => p.result.confidence === 'low'),
  }

  console.log(
    `\n${changed.length} of ${proposals.length} event(s) would change: ${byConfidence.high.length} high, ${byConfidence.medium.length} medium, ${byConfidence.low.length} low confidence.`
  )

  if (byConfidence.low.length > 0) {
    console.log('\nLOW confidence — not applied, review manually:')
    for (const { event, result } of byConfidence.low) {
      console.log(
        `  ${event.id}  ${truncate(event.title, 50).padEnd(50)} ${event.category} → ${result.category}`
      )
    }
  }

  if (!willWrite) {
    console.log(
      dryRun
        ? '\nDry run — no changes written.'
        : '\nReport only — pass --apply-all to write these changes.'
    )
    const after = before
    console.log(
      `\nOTHER: ${after.other} of ${after.total} upcoming events (${pct(after.other, after.total)}) — unchanged.`
    )
    return
  }

  // Apply high + medium confidence changes only
  const toApply = [...byConfidence.high, ...byConfidence.medium]
  console.log(`\nApplying ${toApply.length} change(s)...`)

  let applied = 0
  for (const { event, result, categoryChanged, familyChanged } of toApply) {
    const data: { category?: Category; isFamilyFriendly?: boolean } = {}
    if (categoryChanged) data.category = result.category
    if (familyChanged) data.isFamilyFriendly = true
    if (Object.keys(data).length === 0) continue

    try {
      await prisma.event.update({ where: { id: event.id }, data })
      applied++
    } catch (error) {
      console.error(`  Failed to update ${event.id}:`, error)
    }
  }

  console.log(`Applied ${applied} change(s).`)

  const after = await countOtherShare()
  console.log('\n=== Summary ===')
  console.log(`OTHER before: ${before.other} (${pct(before.other, before.total)} of ${before.total} upcoming)`)
  console.log(`OTHER after:  ${after.other} (${pct(after.other, after.total)} of ${after.total} upcoming)`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
