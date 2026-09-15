# Generic AI source scraper + admin "Sources" page

## Context

Nyack Today (Next.js 16 App Router, Prisma, Supabase Postgres). Read `CLAUDE.md`, `plan.md`, and `data-sources.md` first. This is Phase 1, item 1b of `plan.md`, and it is the leverage move of the whole plan.

The Pulse page (`/admin/pulse`) shows 11 of the next 14 days are thin (fewer than 5 events). The fix is more sources, but each bespoke scraper in `src/lib/scrapers/` costs half a day and breaks when a site changes its markup. There are 11 venues waiting in GitHub issues (#17, #35–#41, #55) and a longer list in `data-sources.md`.

Build one config-driven scraper: a `Source` row in the database describes a page, the scraper fetches it, reduces it to readable text, runs it through the existing AI extraction, and saves the results through the same pipeline as every other scraper. An admin page lets Danny add and test a source in a few minutes with no deploy.

## Read these before writing code

- `src/lib/scrapers/types.ts` — the `Scraper` / `ScrapedEvent` / `ScraperResult` contract.
- `src/lib/scrapers/index.ts` — `scrapers` registry, `runAllScrapers`, `runScraper`, `saveEvent`, `logScraperRun`. Note per-scraper `ScraperLog` rows keyed by `sourceName`; Pulse reads those.
- `src/lib/scrapers/utils.ts` — `makeEasternDate`, `parsePrice`, `guessFamilyFriendly`, `generateEventHash`, `areEventsDuplicates`.
- `src/lib/ai/client.ts` and `src/lib/ai/prompts.ts` — `extractEventsFromEmail` / `extractEventsFromDiscord` / `extractEventsFromInstagram`, `SYSTEM_PROMPT`, `buildUserPrompt`, `cleanEmailHtml`, `estimateTokenCount`. You will add a fourth entry point that shares their internals.
- `src/lib/ai/types.ts` — `ExtractedEvent` (ISO dates, no category).
- `src/lib/discord/processor.ts` — how AI-extracted events become `EventSubmission` rows for admin review.
- `src/lib/scrapers/explorerockland.ts` — a Puppeteer scraper (uses `@sparticuz/chromium` on Vercel); copy its browser setup.
- `src/lib/scrapers/nyackvillage.ts` (RSS) and `src/lib/scrapers/explorerockland.ts` (`node-ical` history in git log) for feed parsing precedents.
- `src/app/admin/scrapers/page.tsx` and `src/app/api/admin/scrapers/route.ts` — admin page and route conventions. `src/middleware.ts` already gates all `/api/admin/*`.
- `src/app/api/scrape/route.ts` — how single scrapers are triggered by name.
- `prisma/manual_instagram_migration.sql` — the shape of a hand-written migration in this repo.

## Data model

Add to `prisma/schema.prisma`:

```prisma
enum SourceFetchMode {
  CHEERIO     // static HTML → readable text
  PUPPETEER   // JS-rendered page → readable text
  ICAL        // .ics feed → structured, no AI needed
  RSS         // RSS/Atom → items → AI on each item body
  JSONLD      // page with schema.org Event JSON-LD → structured, no AI needed
}

model Source {
  id              String          @id @default(cuid())
  name            String          @unique      // becomes sourceName on events + ScraperLog
  slug            String          @unique
  urls            String[]                     // one or more pages/feeds to fetch
  fetchMode       SourceFetchMode @default(CHEERIO)
  defaultVenue    String?                      // used when AI can't determine venue
  defaultAddress  String?
  defaultCity     String          @default("Nyack")
  isNyackProper   Boolean         @default(true)
  defaultCategory Category?                    // hint passed to AI; AI may override
  familyFriendlyHint Boolean?                  // null = let AI decide
  autoPublish     Boolean         @default(false)  // false = events go to EventSubmission for review
  cleanRuns       Int             @default(0)  // consecutive successful reviewed runs; admin flips autoPublish at 3
  enabled         Boolean         @default(true)
  notes           String?                      // admin notes, e.g. "calendar is at bottom of page"
  lastRunAt       DateTime?
  lastStatus      String?
  lastError       String?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@index([enabled])
}
```

Migration: this repo does **not** use `prisma migrate dev` or `db push` (both hang against Supabase here). Write `prisma/manual_source_migration.sql` (DDL only, no trailing SELECT), mirroring `prisma/manual_instagram_migration.sql`, including the enum and an RLS policy consistent with `RLS_MIGRATION_GUIDE.md`. Apply it with the session pooler (transaction pooler host, port 5432, no `pgbouncer=true`):

```bash
SESSION_URL=$(echo "$DATABASE_URL" | sed -E 's/:6543/:5432/; s/[?]pgbouncer=true//')
npx prisma db execute --file prisma/manual_source_migration.sql --url "$SESSION_URL"
npx prisma generate
```

Then verify with a tiny script from the project root that `prisma.source.count()` returns 0. If the connection fails, stop and report; do not try `db push`.

## The scraper: `src/lib/scrapers/generic.ts`

Export `genericSourceScrapers(): Promise<Scraper[]>` that loads all `enabled` Sources and returns one `Scraper` per row (so each Source gets its own `ScraperLog` rows and its own line on `/admin/pulse`). Change `src/lib/scrapers/index.ts` so `runAllScrapers` and `runScraper(name)` include these dynamically loaded scrapers after the static ones. `GET /api/scrape` (the scraper-name list for the admin dropdown) must include them too.

Per fetch mode:

- **CHEERIO**: fetch with a realistic User-Agent and 15 s timeout; strip `script`, `style`, `nav`, `header`, `footer`, `noscript`; collapse whitespace; keep link hrefs inline as `[text](url)` so the AI can return `eventUrl`s; keep `img` `src`/`alt` for the first ~10 images so `imageUrl` can be filled. Cap at ~12k tokens using `estimateTokenCount`; if longer, keep the part of the page with the highest density of date-like strings (a simple sliding window is fine).
- **PUPPETEER**: same, but render first. Copy the Chromium setup from `explorerockland.ts`. Wait for network idle, max 20 s.
- **JSONLD**: parse `application/ld+json` blocks, accept `Event` and `@graph` arrays (see `levitylive.ts` and `visitnyack.ts` for both shapes), map to `ScrapedEvent` with no AI call. If none found, fall back to CHEERIO with a warning in the result.
- **ICAL**: `node-ical` is already a dependency; map VEVENTs directly. Expand recurring VEVENTs for the next 60 days only.
- **RSS**: parse items (there is an RSS precedent in `nyackvillage.ts`); run AI extraction on each item's title + description + link, batching several items per AI call.

AI path (CHEERIO / PUPPETEER / RSS): add `extractEventsFromWebPage({ sourceName, url, text, defaultVenue, defaultAddress, defaultCity, defaultCategory, today })` to `src/lib/ai/client.ts`, sharing the provider fallback and JSON parsing with the existing three entry points (refactor a private `extractWithPrompt` helper if that's cleaner; don't copy-paste a fourth 300-line function). Prompt guidance specific to web pages:
- Today's date and timezone (`America/New_York`) are given; resolve relative and year-less dates against them; ignore events in the past.
- Only return events with a specific date. Skip "every Tuesday" unless a concrete next date is present (recurring events are hand-curated separately).
- Prefer the page's own event URL for `eventUrl`; otherwise the source URL.
- Venue defaults to `defaultVenue` when the page is a venue's own site.
- Return an empty list rather than guessing.

Mapping `ExtractedEvent` → `ScrapedEvent`: reuse whatever the Discord processor does for dates (the AI returns ISO strings; make sure a date with no timezone is interpreted as Eastern, see `TIMEZONE_FIX.md`), `parsePrice`, `guessFamilyFriendly` (unless `familyFriendlyHint` is set), `defaultCategory ?? guessCategory(...)`. If `docs/prompts/recategorize-other.md` has already shipped `categorizeEvent`, use it. Set `sourceName = source.name`, `sourceUrl = eventUrl ?? source url`.

Publishing rule: if `source.autoPublish` is false, the scraper's `scrape()` must **not** return the events for direct insert; instead it creates `EventSubmission` rows with `sourceName = source.name`, `status: PENDING`, exactly like the Discord processor does, deduped against existing pending submissions and existing events (`areEventsDuplicates`), and returns a `ScraperResult` with `events: []` and a status message like `"12 events sent to review"`. Log those counts in `ScraperLog` via `eventsFound` so Pulse still shows the source is alive. If `autoPublish` is true, return events normally and let `saveEvent` handle them. When a run is approved through review with no rejections, the admin can bump `cleanRuns`; the Sources page shows a "3 clean runs, ready to auto-publish" nudge. Do not auto-flip `autoPublish`; that stays a human decision.

Robustness: per-source try/catch so one bad site never kills the run; write `lastRunAt` / `lastStatus` / `lastError` on the Source row; a Source that errors 5 runs in a row is still attempted (no auto-disable) but Pulse will show it stale.

## Admin API

- `GET /api/admin/sources` — list with last-run fields and pending-submission counts per source.
- `POST /api/admin/sources` — create; validate URLs, unique name/slug (derive slug from name).
- `PATCH /api/admin/sources/[id]` — edit any field including `enabled`, `autoPublish`, `cleanRuns`.
- `DELETE /api/admin/sources/[id]` — delete the row only (events and submissions keep their `sourceName` string).
- `POST /api/admin/sources/[id]/test` — **dry run**: fetch + extract and return the would-be events as JSON without writing anything. Include the reduced page text length, token estimate, fetch mode used, elapsed ms, and any warnings. This is the tool that makes onboarding a source take minutes: Danny pastes a URL, hits Test, sees what comes back, adjusts fetch mode or default venue, tests again, saves.
- `POST /api/admin/sources/[id]/run` — real run of just this source via `runScraper(source.name)`.

## Admin page: `/admin/sources`

Client component in the existing admin style (`stone`/`orange` Tailwind, white `rounded-xl` cards; see `src/app/admin/page.tsx`).

- Table of sources: name, fetch mode pill, enabled toggle, auto-publish pill ("Review" / "Auto"), last run (relative time + status), pending submissions count linking to `/admin/submissions`, and Run / Test / Edit buttons.
- "Add source" opens a form: name, URLs (one per line), fetch mode (with one-line help per mode), default venue/address/city, Nyack-proper checkbox, default category, family-friendly hint (Auto / Yes / No), notes. A **Test** button on the form itself runs the dry-run against the unsaved values (so add a `POST /api/admin/sources/test` variant that takes the config in the body) and renders the results as a compact list: title, date/time in Eastern, venue, price, URL, plus the warnings. Save is enabled after any test, not only successful ones.
- Link "Sources" in the admin nav in `src/app/admin/layout.tsx` and the quick actions on `src/app/admin/page.tsx`, next to Scrapers and Pulse.

## Seed the first sources

After the page works, add these through the UI (or a seed script that calls the same create logic) and run Test on each. Record what happened in `data-sources.md` under a new "Generic sources" table (name, URL, mode that worked, events found on first test, notes). Do not spend more than ~15 minutes per source; if one doesn't work, note why and move on.

1. Nyack Center — https://nyackcenter.org/ (find the events page)
2. Edward Hopper House — https://www.edwardhopperhouse.org/ (events/calendar page; likely needs PUPPETEER)
3. Nyack Chamber of Commerce — https://www.nyackchamber.org/ (events page)
4. Big Red Books — find site or events page
5. Homebody Books — find site or events page
6. Creative Arts Workshop — find site
7. Helen Hayes Theater — https://www.helenhayestheatre.org/ or whatever the current site is
8. Nyack Library — https://www.nyacklibrary.org/eventscalendar.html — try to find the LocalHop feed/JSON endpoint first (open DevTools network tab logic: look for XHR/JSON or `.ics` URLs in the page source); if there is an iCal or JSON feed, use ICAL/JSONLD mode; otherwise PUPPETEER. This is the single biggest family source in town, so it's worth 30 minutes instead of 15.

Leave every seeded source with `autoPublish = false`. Danny reviews the first batch in `/admin/submissions`.

## Constraints

- Public API (`/api/events`, `/api/activities`, `docs/public-api.md`) unchanged.
- No changes to existing scraper files beyond the registry in `index.ts`.
- Respect `robots.txt` for CHEERIO/PUPPETEER fetches (a simple check of `Disallow` for the path is enough); if disallowed, return an error result saying so rather than fetching.
- Vercel function limit is 300 s (`vercel.json`). The daily run already runs 17 scrapers; keep the generic ones bounded: 20 s fetch cap per URL, max 3 URLs per source, and run generic sources after the static ones so a slow site can't starve them. If total runtime becomes a risk, note it in the PR; splitting the cron into two invocations is a follow-up, not part of this task.
- TypeScript strict, `npm run lint` and `npm run build` pass.

## Verification (run and report real output)

1. Migration applied; `prisma.source.count()` works.
2. `npm run lint` and `npm run build` pass.
3. Create a source via the UI pointing at a page you know has events (e.g. https://www.nyackcenter.org or https://visitnyack.org/calendar/ as a control since a bespoke scraper already covers it), run Test, and paste the returned events. Check at least one date/time against the page by hand; it must be correct in Eastern time.
4. Run it for real with `autoPublish = false`; confirm the events appear in `/admin/submissions` as PENDING with `sourceName` = the source name, and a `ScraperLog` row exists so `/admin/pulse` lists the source.
5. Run it again; confirm no duplicate submissions were created.
6. Flip `autoPublish = true` on the control source, run it, confirm events are inserted (or marked duplicate against the bespoke scraper's events, which proves dedup works across sources).
7. `GET /api/scrape` (unauthenticated) lists the new source names alongside the static scrapers.
8. Disable a source and confirm the daily orchestrator skips it.
9. Report the seeding results table for the 8 sources above.

## When done

Update `plan.md`: add a "Done" line under Phase 1 item 1b with the date and the number of sources onboarded and events they produced. Update `data-sources.md` as described. Update `CLAUDE.md`'s Scraper Tiers section to mention the config-driven generic scraper and the `/admin/sources` page.
