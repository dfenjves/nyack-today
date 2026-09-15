/**
 * Run every enabled generic source through the normal orchestrator path and
 * print per-source timing — the numbers you need to know whether the nightly
 * run still fits inside Vercel's 300 s function limit.
 *
 *   npx tsx scripts/run-generic-sources.ts
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
import { runScraper } from '../src/lib/scrapers'

const prisma = new PrismaClient()

async function main() {
  const sources = await prisma.source.findMany({
    where: { enabled: true },
    orderBy: { name: 'asc' },
    select: { name: true, fetchMode: true },
  })

  let total = 0
  for (const source of sources) {
    const startedAt = Date.now()
    const result = await runScraper(source.name)
    const elapsed = Date.now() - startedAt
    total += elapsed

    console.log(
      `${source.name} [${source.fetchMode}] — ${(elapsed / 1000).toFixed(1)}s — ` +
        `${result?.status ?? 'not found'} — found ${result?.eventsFound ?? result?.events.length ?? 0}`
    )
    if (result?.errorMessage) console.log(`    ${result.errorMessage}`)
  }

  console.log(`\nGeneric sources total: ${(total / 1000).toFixed(1)}s across ${sources.length} sources`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
