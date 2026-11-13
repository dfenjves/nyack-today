/**
 * Tests for the Rockland County Chess Club scraper's parsing (chess67.com).
 *
 * Run: npm test   (node --test via tsx). No network, no database.
 *
 * Regression: the old parser rebuilt dates from the UTC calendar day, so a
 * Thursday 7 PM event in EST (= Friday 00:00 UTC) was listed on Friday.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  extractChess67Events,
  chess67ToScrapedEvents,
  type Chess67Event,
} from '../src/lib/scrapers/rocklandchess'

function easternWeekday(d: Date): string {
  return d.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long' })
}
function easternTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })
}

const base: Chess67Event = {
  title: 'Social Chess Games',
  slug: 'social-chess-games-20261119',
  start_at: '2026-11-20T00:00:00+00:00',
  end_at: '2026-11-20T02:00:00+00:00',
  status: 'scheduled',
  cancelled_at: null,
  is_published: true,
  is_listed: true,
  description: 'Weekly meet-up for social chess games.',
  address: '70 Main St, Nyack, NY 10960, USA',
  image_url: null,
  require_payment: false,
  payment_mode: 'disabled',
  event_sessions: [],
}

const now = new Date('2026-11-13T17:00:00Z')

test('a Thursday 7 PM event in EST stays on Thursday', () => {
  const [e] = chess67ToScrapedEvents([base], now)
  assert.equal(easternWeekday(e.startDate), 'Thursday')
  assert.equal(easternTime(e.startDate), '7:00 PM')
  assert.equal(e.startDate.toISOString(), '2026-11-20T00:00:00.000Z')
  assert.equal(e.isFree, true)
  assert.equal(e.address, '70 Main St')
  assert.equal(
    e.sourceUrl,
    'https://chess67.com/club/the-rockland-county-chess-club/events/social-chess-games-20261119'
  )
})

test('a Thursday 7 PM event in EDT stays on Thursday', () => {
  const [e] = chess67ToScrapedEvents(
    [{ ...base, start_at: '2027-04-01T23:00:00+00:00', end_at: null }],
    now
  )
  assert.equal(easternWeekday(e.startDate), 'Thursday')
  assert.equal(easternTime(e.startDate), '7:00 PM')
})

test('a multi-week class becomes one paid event per upcoming session', () => {
  const events = chess67ToScrapedEvents(
    [
      {
        ...base,
        title: 'November Chess Classes - Youth (Beginners)',
        slug: 'november-chess-classes-youth-beginners-20261104',
        start_at: '2026-11-04T21:30:00+00:00',
        end_at: '2026-11-25T22:30:00+00:00',
        address: '70 Main St - 70 Main St, Nyack, NY 10960, 3rd Floor',
        require_payment: true,
        payment_mode: 'required',
        event_sessions: [
          { starts_at: '2026-11-04T21:30:00+00:00', ends_at: '2026-11-04T22:30:00+00:00' },
          { starts_at: '2026-11-11T21:30:00+00:00', ends_at: '2026-11-11T22:30:00+00:00' },
          { starts_at: '2026-11-18T21:30:00+00:00', ends_at: '2026-11-18T22:30:00+00:00' },
          { starts_at: '2026-11-25T21:30:00+00:00', ends_at: '2026-11-25T22:30:00+00:00' },
        ],
      },
    ],
    now
  )
  assert.equal(events.length, 2) // Nov 4 and 11 are past
  for (const e of events) {
    assert.equal(easternWeekday(e.startDate), 'Wednesday')
    assert.equal(easternTime(e.startDate), '4:30 PM')
    assert.equal(e.category, 'CLASSES_WORKSHOPS')
    assert.equal(e.isFree, false)
    assert.equal(e.address, '70 Main St')
  }
})

test('past, cancelled, and unlisted events are skipped', () => {
  const events = chess67ToScrapedEvents(
    [
      { ...base, start_at: '2026-11-06T00:00:00+00:00' },
      { ...base, cancelled_at: '2026-11-10T00:00:00+00:00' },
      { ...base, status: 'cancelled' },
      { ...base, is_listed: false },
      { ...base, is_published: false },
    ],
    now
  )
  assert.equal(events.length, 0)
})

test('extracts pageEvents from the vike page-context script', () => {
  const ctx = { clubPageData: { pageEvents: [base] } }
  const html = `<html><script id="vike_pageContext" type="application/json">${JSON.stringify(ctx)}</script></html>`
  assert.equal(extractChess67Events(html).length, 1)
  assert.deepEqual(extractChess67Events('<html></html>'), [])
})
