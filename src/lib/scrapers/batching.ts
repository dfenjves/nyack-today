/**
 * The two pure mechanics behind the split daily scrape.
 *
 * Kept in their own module, free of scraper and Prisma imports, so the tests
 * can exercise the real code instead of a copy of it — importing
 * `src/lib/scrapers/index.ts` would pull in every scraper (and with them
 * puppeteer, discord.js and googleapis) just to check some arithmetic.
 */

/** One page of a batched list, plus what the caller needs to ask for the next. */
export interface Batch<T> {
  items: T[]
  /** Length of the full list, not of this page. */
  total: number
  batch: number
  /** The batch size actually used; equals `total` when unbatched. */
  batchSize: number
  hasMore: boolean
}

/**
 * Take the `batch`-th (0-based) slice of `items`.
 *
 * A missing or non-positive `batchSize` means "all of them in one batch". A
 * `batch` past the end yields an empty page with `hasMore: false` rather than
 * an error, so a paging loop that overshoots ends quietly instead of failing
 * the nightly workflow.
 */
export function takeBatch<T>(
  items: T[],
  options: { batch?: number; batchSize?: number } = {}
): Batch<T> {
  const total = items.length
  const batchSize =
    options.batchSize && options.batchSize > 0 ? Math.floor(options.batchSize) : total
  const batch = options.batch && options.batch > 0 ? Math.floor(options.batch) : 0

  const start = batch * batchSize
  const page = batchSize > 0 ? items.slice(start, start + batchSize) : items

  return {
    items: page,
    total,
    batch,
    batchSize,
    hasMore: start + page.length < total,
  }
}

/** Thrown by `withTimeout` when a scraper blows its wall-clock budget. */
export class ScraperTimeoutError extends Error {
  constructor(ms: number) {
    super(`Timed out after ${ms >= 1000 ? `${Math.round(ms / 1000)}s` : `${ms}ms`}`)
    this.name = 'ScraperTimeoutError'
  }
}

/**
 * Stop waiting on `promise` after `ms` and reject with a `ScraperTimeoutError`.
 *
 * Two honest limits, because this is a `Promise.race` and not a cancellation:
 *
 * 1. The abandoned work keeps running in the background. That is safe here —
 *    every scraper that owns a browser closes it in a `finally` (see
 *    `fetchRenderedHtml`) — but it means the *process* is only free once that
 *    work finishes.
 * 2. The timer needs the event loop to be free to fire. A scraper that blocks
 *    on synchronous CPU work is not interrupted, and can even win the race
 *    after its deadline has passed.
 *
 * So this bounds how long the orchestrator *waits* on a source hung on I/O; it
 * is a backstop, not a substitute for each fetch having its own timeout. The
 * fetches do: see `FETCH_TIMEOUT_MS` / `PUPPETEER_TIMEOUT_MS` in ./generic and
 * `AI_REQUEST_TIMEOUT_MS` in src/lib/ai/client.ts.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ScraperTimeoutError(ms)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}
