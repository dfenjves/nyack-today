# Build the admin "Pulse" page with a 14-day coverage grid

## Context

This is Nyack Today, a Next.js 16 (App Router) + Prisma + Supabase Postgres events aggregator for Nyack, NY. Read `CLAUDE.md` and `plan.md` first. This task is Phase 0, item 2 of `plan.md`: the admin Pulse page. It is the first deliverable of the "Measure" pillar, and the "done when" for Phase 0 depends on it.

The problem it solves: we currently cannot see whether coverage is thin until a visitor sees an empty "tonight". On 2026-09-14 the live site had 2 events tonight, 4 tomorrow, and 1 family event in 30 days, and nobody noticed. The Pulse page turns that into something visible every Monday.

## What to build

A new admin page at `/admin/pulse` backed by a new API route `GET /api/admin/pulse`. No schema changes. No public API changes.

### 1. API route: `src/app/api/admin/pulse/route.ts`

Auth: nothing to do. `src/middleware.ts` already gates every `/api/admin/*` route via the `admin_password` cookie or `x-admin-password` header. Do not add a second check.

Response shape (design it as a typed interface exported from `src/lib/utils/pulse.ts` and reused by the page):

```ts
interface PulseResponse {
  generatedAt: string            // ISO
  timezone: 'America/New_York'
  coverage: {
    days: Array<{
      date: string               // 'YYYY-MM-DD' in Eastern time
      weekday: string            // 'Mon'
      total: number
      byCategory: Record<Category, number>
      familyFriendly: number
      free: number
      status: 'ok' | 'thin' | 'empty'   // thin: total < 5, empty: 0
    }>                           // exactly 14 entries, today first
    categoriesWithEventsThisWeek: number   // of 11
    otherShare: number           // 0..1, share of events in window with category OTHER
  }
  sources: Array<{
    sourceName: string
    lastRunAt: string | null
    lastSuccessAt: string | null
    lastStatus: string | null
    eventsFoundLastRun: number
    eventsAddedLast7Days: number
    upcomingEvents: number       // non-hidden events from this source in next 30 days
    status: 'ok' | 'stale' | 'zero' | 'never'
      // stale: no success in > 3 days; zero: last run succeeded with 0 found; never: no log rows
  }>
  audience: {
    subscribersActive: number
    subscribersLast7Days: number
    devicesActive: number
    devicesLast7Days: number
    submissionsLast7Days: number
    submissionsPending: number
  }
}
```

Coverage computation rules:
- Window: 14 Eastern-time calendar days starting today. Use the helpers in `src/lib/utils/dates.ts` (`getToday`, `getNowInEastern`) and `src/lib/utils/timezone.ts` to build the boundaries. Bucket each event by its Eastern calendar date, not UTC. Event times are stored in UTC; an event at 9 PM Eastern is the next UTC day, and it must land in the Eastern day.
- Include only `isHidden: false`.
- Do not call `queryEvents()` from `src/lib/utils/events-query.ts` for this. It caps at 100 rows and paginates, so it would undercount. Write a dedicated query: fetch all non-hidden one-time events with `startDate` in the window, plus all non-hidden `isRecurring` events, and expand the recurring ones with `generateRecurringInstances` from `src/lib/utils/recurrence.ts` (read that file to see the exact signature and how `queryEvents` uses it, and match that behavior so the grid agrees with what the public site shows).
- Apply the same dedup that `queryEvents` applies (`areEventsDuplicates` from `src/lib/scrapers/utils.ts`) so the grid doesn't count duplicates the public site hides.
- `categoriesWithEventsThisWeek` counts distinct categories across the first 7 days of the grid. There are 11 categories in the `Category` enum.

Sources computation rules:
- The canonical list of sources is the scrapers registered in `src/lib/scrapers/index.ts` (each has a `name`). Also include any `sourceName` that appears in `ScraperLog` or on upcoming events but isn't a registered scraper (e.g. `User Submission`, `Patch Nyack`), flagged with a boolean `registered: false` so they render differently. Look at `src/app/api/scrape/route.ts` GET handler to see how the scraper name list is already exposed.
- `lastSuccessAt` is the latest `ScraperLog.runAt` with `status = 'success'` (check what statuses `src/lib/scrapers/index.ts` actually writes; `partial` may count as success for staleness purposes, decide and document in a code comment).
- Use `groupBy` / a small number of queries, not one query per source.

Audience: `Subscriber` (`isActive`, `subscribedAt`), `Device` (`isActive`, `createdAt`), `EventSubmission` (`submittedAt`, `status`). Straight counts.

Set `Cache-Control: private, no-store`. Admin data.

### 2. Page: `src/app/admin/pulse/page.tsx`

Client component, same pattern as `src/app/admin/scrapers/page.tsx` (fetch on mount, loading state, error state). Match the existing admin UI styling exactly: look at `src/app/admin/page.tsx` and its `StatCard` helper. The admin uses Tailwind `stone`/`orange` utility classes and white cards with `rounded-xl border border-stone-200`. Do not introduce the public site's forest/oat palette here.

Layout, top to bottom:

1. **Header row.** "Pulse" title, "Generated 2 min ago" subtitle, a Refresh button.

2. **Audience tiles** (4-up grid like the dashboard): Weekly Active Locals, Email subscribers, iOS devices, Submissions this week.
   - Weekly Active Locals is not computable yet. Render the tile with an em-dash value and the caption "Not instrumented yet, see plan.md Phase 0 #1", linking to the Vercel Analytics dashboard URL if `NEXT_PUBLIC_VERCEL_ANALYTICS_URL` is set, otherwise no link. Do not fake a number.
   - Each other tile shows the total and a small "+N this week" line.

3. **Coverage grid.** The centerpiece. A table with one column per day (14 columns) and one row per category (11 rows, ordered as in `categoryLabels` in `src/lib/utils/categories.ts`), plus a **Total** row at the top, and **Family-friendly** and **Free** rows at the bottom.
   - Column headers: weekday abbreviation on line one, `M/D` on line two. Today's column is visually marked. Weekend columns (Sat/Sun) get a subtly different header background.
   - Cells: the count, or an empty cell (not `0`) when zero, so the eye goes to gaps.
   - Total row cells are color-coded by `status`: `empty` red (`bg-red-100 text-red-800`), `thin` amber (`bg-amber-100 text-amber-800`), `ok` green (`bg-green-50 text-green-800`). Category cells are neutral.
   - Above the grid, one line of summary chips: "N thin days", "N empty days", "Categories this week: 8 of 11", "Other: 23%". Chips turn amber/red on the same thresholds (Other > 10% amber, > 20% red).
   - The table must scroll horizontally inside its own container on narrow screens (`overflow-x-auto`), with the category label column sticky on the left.
   - Clicking a day header links to the public site for that day: `/?date=custom&customStart=<ISO>&customEnd=<ISO>` (check `src/app/HomeClient.tsx` `buildQueryString` for the exact param names so the link actually works). Clicking a category row label links to `/admin/events?category=<CATEGORY>` if that page supports it; if it doesn't, skip the link rather than add a broken one.

4. **Sources table.** One row per source, sorted so problems float to the top: `never`, then `stale`, then `zero`, then `ok`. Columns: Source, Status pill, Last success (relative, e.g. "3d ago"), Last run result (status + events found), Added last 7 days, Upcoming events. Unregistered sources render with a muted "manual" pill instead of a status. Each row links to `/admin/scrapers?source=<name>` if that page reads a `source` query param; check `src/app/admin/scrapers/page.tsx` and add the param handling there if it's a small change, otherwise link without the param.

5. Add a "Pulse" link to the admin navigation. Find where `/admin/scrapers` is linked in `src/app/admin/layout.tsx` (nav) and `src/app/admin/page.tsx` (quick actions) and add Pulse next to it in both.

### Thresholds

Put these in one exported constants object in `src/lib/utils/pulse.ts` so the quiet-day alert (Phase 0 #3, a separate task) can reuse them:

```ts
export const PULSE_THRESHOLDS = {
  thinDayEvents: 5,        // total < 5 is 'thin'
  staleSourceDays: 3,      // no success in > 3 days is 'stale'
  otherShareWarn: 0.10,
  otherShareBad: 0.20,
}
```

## Constraints

- **No Prisma schema changes.** Everything needed is already in `Event`, `ScraperLog`, `Subscriber`, `Device`, `EventSubmission`. If you think you need a migration, stop and explain why instead. (Migrations in this repo are applied by hand via SQL; `prisma migrate dev` hangs here.)
- **Do not modify `/api/events`, `/api/activities`, or anything in `docs/public-api.md`.** That contract is append-only and used by the iOS app.
- Do not touch the scrapers.
- Keep the page under ~350 lines; split the grid into `src/components/admin/CoverageGrid.tsx` and the sources table into `src/components/admin/SourcesTable.tsx` if it grows past that.
- TypeScript strict, no `any`. `npm run lint` must pass.
- Timezone correctness matters more than anything else on this page. See `TIMEZONE_FIX.md` in the repo root for history on how this has gone wrong before.

## Verification (run these and report the actual output)

1. `npm run lint` and `npm run build` succeed.
2. `curl -s -H "x-admin-password: $ADMIN_PASSWORD" http://localhost:3000/api/admin/pulse | jq '.coverage.days | length'` prints `14`.
3. `curl -s -H "x-admin-password: $ADMIN_PASSWORD" "http://localhost:3000/api/admin/pulse" | jq '.coverage.days[0]'` and compare its `total` with `curl -s "http://localhost:3000/api/events?date=tonight&limit=100" | jq '.events | length'`. They should match, or you should explain the difference (e.g. `tonight` on the public site starts at "now", not midnight, so the pulse count for today may be higher by the number of events already past). Do the same for `date=tomorrow` against `days[1]`; those should match exactly.
4. Timezone check: create a temporary hidden test or a one-off script that inserts (or finds) an event at 9:30 PM Eastern and confirm it lands in the correct Eastern day column, not the next UTC day. Remove any test data you created.
5. Recurrence check: pick a recurring event from the DB (`isRecurring: true`) and confirm it appears in every column matching its `recurrenceDays`.
6. Unauthenticated `curl http://localhost:3000/api/admin/pulse` returns 401/403, not data.
7. Load `/admin/pulse` in the browser at desktop and ~400px widths. Confirm the grid scrolls horizontally without the page scrolling sideways, the category column stays sticky, and the day-header links open the public site filtered to that day with real events shown.
8. Paste a screenshot or describe what the grid shows for the next 14 days as of today, including how many thin/empty days there are. That number is the baseline for `plan.md`.

## Out of scope for this task

- Product analytics / `AnalyticsEvent` (Phase 0 #1)
- The quiet-day Discord alert (Phase 0 #3), though the thresholds you export will feed it
- Any Vercel Analytics API integration for Weekly Active Locals
- Fixing individual scrapers that the sources table reveals as stale

When done, update `plan.md`: under Phase 0, add a "Done" line for item 2 with the date, and fill in the baseline numbers the page reveals (subscribers, devices, thin days) in the §1 metrics table where they currently say *unknown* or *check admin*.
