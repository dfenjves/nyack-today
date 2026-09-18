/**
 * Tests for the bounded scrape groups: how `?group=generic&batch=N&batchSize=M`
 * slices the source list, and what the per-scraper timeout does and does not
 * protect against.
 *
 * Run: npm test   (node --test via tsx)
 *
 * No network and no database — `src/lib/scrapers/batching.ts` is deliberately
 * free of scraper and Prisma imports so these can test the real code.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { takeBatch, withTimeout, ScraperTimeoutError } from '../src/lib/scrapers/batching'

const five = ['a', 'b', 'c', 'd', 'e']

test('the first batch returns batchSize sources and reports more', () => {
  const page = takeBatch(five, { batch: 0, batchSize: 2 })
  assert.deepEqual(page.items, ['a', 'b'])
  assert.equal(page.total, 5)
  assert.equal(page.hasMore, true)
})

test('a final partial batch reports no more', () => {
  const page = takeBatch(five, { batch: 2, batchSize: 2 })
  assert.deepEqual(page.items, ['e'])
  assert.equal(page.hasMore, false)
})

test('a batch past the end is empty, not an error', () => {
  const page = takeBatch(five, { batch: 3, batchSize: 2 })
  assert.deepEqual(page.items, [])
  assert.equal(page.hasMore, false)
  assert.equal(page.total, 5)
})

test('an exactly-filled final batch does not claim more', () => {
  const page = takeBatch(['a', 'b', 'c', 'd'], { batch: 1, batchSize: 2 })
  assert.deepEqual(page.items, ['c', 'd'])
  assert.equal(page.hasMore, false)
})

test('no batchSize runs every source in one batch', () => {
  const page = takeBatch(five)
  assert.deepEqual(page.items, five)
  assert.equal(page.batchSize, 5)
  assert.equal(page.hasMore, false)
})

test('an empty source list yields an empty first batch', () => {
  const page = takeBatch([], { batch: 0, batchSize: 4 })
  assert.deepEqual(page.items, [])
  assert.equal(page.hasMore, false)
})

test('nonsense batch/batchSize values fall back to one full batch', () => {
  const page = takeBatch(five, { batch: -3, batchSize: -1 })
  assert.deepEqual(page.items, five)
  assert.equal(page.batch, 0)
  assert.equal(page.hasMore, false)
})

/* -------------------------------------------------------------------------- */
/* The per-scraper timeout                                                    */
/* -------------------------------------------------------------------------- */

test('a scraper that finishes in time is unaffected', async () => {
  assert.equal(await withTimeout(Promise.resolve('events'), 1000), 'events')
})

test('a scraper hung on I/O is abandoned at its deadline', async () => {
  const started = Date.now()
  await assert.rejects(withTimeout(new Promise(() => {}), 200), ScraperTimeoutError)
  assert.ok(Date.now() - started < 2000, 'should reject at the deadline, not hang')
})

test('the timeout message is the one ScraperLog and Pulse show', () => {
  // The budgets in production are whole seconds (60s / 90s / 100s); the
  // sub-second spelling only shows up in tests like the one above.
  assert.equal(new ScraperTimeoutError(90_000).message, 'Timed out after 90s')
  assert.equal(new ScraperTimeoutError(200).message, 'Timed out after 200ms')
})

test("a scraper's own error surfaces unchanged, not as a timeout", async () => {
  await assert.rejects(
    withTimeout(Promise.reject(new Error('HTTP 503')), 1000),
    (error: Error) => error.message === 'HTTP 503'
  )
})

test('the timer is cleared, so a finished scraper leaves nothing pending', async () => {
  // If the 10s timer outlived the race, this test file would hang on exit.
  await withTimeout(Promise.resolve(1), 10_000)
  assert.ok(true)
})

test('synchronous work is NOT interrupted — the budget bounds waiting, not CPU', async () => {
  // Documents a real limit: a scraper that blocks the event loop keeps the
  // timer from firing and can win the race after its deadline. Every fetch
  // path therefore carries its own timeout; this wrapper is only a backstop.
  const started = Date.now()
  const result = await withTimeout(
    (async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      const until = Date.now() + 300
      while (Date.now() < until) {
        /* block the event loop past the deadline */
      }
      return 'finished anyway'
    })(),
    100
  )
  assert.equal(result, 'finished anyway')
  assert.ok(Date.now() - started >= 300)
})
