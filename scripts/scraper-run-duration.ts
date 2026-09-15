/**
 * How long a full nightly scrape takes, measured from ScraperLog.
 *
 * Each scraper writes its log row when it finishes, so the spread between the
 * first and last row of a run is the orchestrator's wall time — the number that
 * matters against Vercel's 300 s function limit (vercel.json).
 *
 *   npx tsx scripts/scraper-run-duration.ts [runs]
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/** Rows more than this far apart belong to different runs. */
const RUN_GAP_MS = 10 * 60 * 1000

async function main() {
  const runsWanted = parseInt(process.argv[2] ?? '5', 10)

  const logs = await prisma.scraperLog.findMany({
    orderBy: { runAt: 'desc' },
    take: 600,
    select: { sourceName: true, runAt: true, status: true, eventsFound: true },
  })
  logs.reverse()

  const runs: (typeof logs)[] = []
  for (const log of logs) {
    const current = runs[runs.length - 1]
    const previous = current?.[current.length - 1]
    if (!previous || log.runAt.getTime() - previous.runAt.getTime() > RUN_GAP_MS) {
      runs.push([log])
    } else {
      current.push(log)
    }
  }

  for (const run of runs.slice(-runsWanted)) {
    const start = run[0].runAt
    const end = run[run.length - 1].runAt
    const seconds = (end.getTime() - start.getTime()) / 1000
    const slowest = [...run]
      .map((log, index) => ({
        name: log.sourceName,
        seconds: index === 0 ? 0 : (log.runAt.getTime() - run[index - 1].runAt.getTime()) / 1000,
      }))
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 5)

    console.log(
      `${start.toISOString()} — ${run.length} scrapers, ${seconds.toFixed(1)}s ` +
        `(first row to last; the first scraper's own time is not counted)`
    )
    console.log(
      `   slowest: ${slowest.map((s) => `${s.name} ${s.seconds.toFixed(1)}s`).join(', ')}`
    )
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
