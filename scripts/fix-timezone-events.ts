/**
 * One-time script to delete all future events from scrapers that had the
 * timezone bug (times stored as UTC instead of Eastern). After running this,
 * re-trigger the affected scrapers to repopulate with correct times.
 *
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/fix-timezone-events.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const AFFECTED_SOURCES = [
  'Rockland County Chess Club',
  'Village of Nyack',
  "Olive's",
  'Rivertown Film',
  'Rockland Center for the Arts',
  'Scott & Joe',
]

async function main() {
  const now = new Date()

  // Preview what will be deleted
  const events = await prisma.event.findMany({
    where: {
      sourceName: { in: AFFECTED_SOURCES },
      startDate: { gte: now },
    },
    select: { id: true, title: true, sourceName: true, startDate: true },
    orderBy: { startDate: 'asc' },
  })

  console.log(`Found ${events.length} future events from affected scrapers:\n`)
  for (const e of events) {
    console.log(`  [${e.sourceName}] ${e.title.slice(0, 45).padEnd(45)} ${e.startDate.toISOString()}`)
  }

  if (events.length === 0) {
    console.log('Nothing to delete.')
    return
  }

  const ids = events.map(e => e.id)

  console.log(`\nDeleting ${ids.length} events...`)
  const result = await prisma.event.deleteMany({
    where: { id: { in: ids } },
  })
  console.log(`Deleted ${result.count} events.`)
  console.log('\nDone. Re-run the affected scrapers to repopulate with correct times.')
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
