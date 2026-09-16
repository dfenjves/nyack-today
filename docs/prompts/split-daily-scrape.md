# Split the daily scrape into bounded invocations + wire the AI categorizer into generic sources

## Context

Nyack Today (Next.js 16 App Router, Prisma, Supabase Postgres, Vercel). Read `CLAUDE.md` and `plan.md` first. This is the infrastructure follow-up flagged at the end of Phase 1 item 1b in `plan.md`.

The daily scrape is one HTTP call: the GitHub Actions workflow `.github/workflows/daily-scrape.yml` hits `POST /api/scrape?cleanup=true` once at 11:00 UTC, and that single Vercel function runs all 17 static scrapers and then every enabled generic `Source` (see `src/lib/scrapers/index.ts`: `getAllScrapers`, `runAllScrapers`, and `src/lib/scrapers/generic.ts`: `genericSourceScrapers`). `vercel.json` sets `maxDuration: 300` for API routes. Measured locally, the static scrapers take about 120 s and the five enabled generic sources add about 112 s (Nyack Library alone 70 s), so a full run is already about 240 s, and Vercel's Chromium cold start is slower than local. One more Puppeteer source and the run gets killed mid-way with no log rows for whatever didn't finish.

Two deliverables, one PR.

## Deliverable 1: bounded scrape groups

Add a `group` query param to `POST /api/scrape` in `src/app/api/scrape/route.ts`:

- `group=static` runs only the scrapers in the static `scrapers` array.
- `group=generic` runs only the enabled generic sources.
- `group=generic&batch=N&batchSize=M` runs the Nth slice (0-based) of enabled generic sources, ordered by `Source.name`, so the workflow can page through them as the list grows. Return `{ batch, batchSize, totalSources, hasMore }` in the response so the caller knows whether to continue.
- No `group` keeps today's behavior (everything), so nothing else that calls this route breaks. The existing `source=<name>` param still runs one scraper and takes precedence over `group`.
- `cleanup=true` should run exactly once per day. Make it run only when `group` is absent or `group=static`, and document that in the route's comment.

In `src/lib/scrapers/index.ts`, refactor so `runAllScrapers` takes an optional `Scraper[]` (default: everything), and add `getStaticScrapers()` and `getGenericScrapers({ batch, batchSize })` next to the existing `getAllScrapers()`. Keep `runScraper(name)` working for both kinds.

Per-scraper time budget: wrap each scraper's `scrape()` in a timeout (a `Promise.race` with a `setTimeout`, no new dependency) so one hung site can't consume the whole function. Default 90 s for static scrapers, and for generic sources 60 s for CHEERIO/ICAL/RSS/JSONLD and 100 s for PUPPETEER. On timeout, log a `ScraperLog` row with `status: 'error'` and `errorMessage: 'Timed out after Ns'` so Pulse shows it, and continue with the next scraper. Make sure a timed-out Puppeteer run closes its browser (check how `generic.ts` and `explorerockland.ts` manage the browser lifecycle; add a `finally` if missing).

Response: include `durationMs` per scraper and a total in the `/api/scrape` JSON so the workflow log shows where time goes. Also add a `console.log` line per scraper with its duration; Vercel function logs are the only place to see this in production.

Update `.github/workflows/daily-scrape.yml` to make three sequential calls, each with its own step and its own status check, so one failure is visible and doesn't hide the others:

1. `POST /api/scrape?group=static&cleanup=$CLEANUP`
2. `POST /api/scrape?group=generic&batch=0&batchSize=4`
3. A loop that continues with `batch=1, 2, …` while the previous response's `hasMore` is true (a small bash `while` with `jq`), capped at 10 batches.

Keep the existing `curl -sL`, `x-scraper-key` header, response parsing, and failure step. Print a per-step summary using `.results[] | "\(.sourceName): \(.status) \(.eventsFound) found \(.durationMs)ms"`.

Also update the manual `workflow_dispatch` inputs so a human can trigger just one group from the GitHub UI (`group` choice: all / static / generic).

## Deliverable 2: use the AI categorizer for generic sources

`src/lib/scrapers/generic.ts` has a TODO near line 580 in `toScrapedEvent`: it currently sets `category: defaultCategory ?? guessCategory(...)`. `src/lib/ai/categorize.ts` (`categorizeEvents`, batched, cached, never throws) shipped since. The scraper save path in `index.ts` already calls it for events that go through `saveEvent`, so **auto-publish** sources are covered. Sources in **review mode** go through `submitEventsForReview` in `generic.ts` and create `EventSubmission` rows directly, bypassing that hook, so those submissions arrive with a weak category.

Fix: in `submitEventsForReview`, call `categorizeEvents` once for the batch of new submissions (after dedup, before insert) and apply the result the same way `index.ts` does: the AI category wins over `guessCategory`, but a `defaultCategory` set on the Source wins over the AI. Apply `isFamilyFriendly` only `false → true` at high confidence. Remove the TODO. Check how the Discord processor applies the categorizer to its submissions and match that shape.

## Constraints

- No Prisma schema changes.
- Public API (`/api/events`, `/api/activities`, `docs/public-api.md`) untouched.
- Do not change `vercel.json` crons; the scrape is deliberately triggered from GitHub Actions (see PR #112 in `git log`). Keep it there.
- Don't change scraper behavior beyond the timeout wrapper.
- TypeScript strict; `npm run lint` (0 errors), `npm test`, and `npm run build` pass.

## Verification (run and report real output)

1. `POST /api/scrape?group=static` locally with the `x-scraper-key` header: response lists only the 17 static scrapers, with `durationMs` on each. Paste the totals.
2. `POST /api/scrape?group=generic&batch=0&batchSize=2` returns two sources and `hasMore: true`; `batch=2&batchSize=2` returns the fifth source and `hasMore: false`; `batch=3` returns an empty result, not an error.
3. `POST /api/scrape?source=Nyack%20Library` still works.
4. Timeout path: temporarily point a test Source at a URL that hangs (e.g. a local `nc -l` or `https://httpstat.us/200?sleep=200000`), set its mode to CHEERIO, run it, and confirm a `ScraperLog` error row with the timeout message appears within ~60 s and the response continues. Delete the test Source afterwards.
5. Categorizer: create or reuse a review-mode source, run it, and confirm the new `EventSubmission` rows have non-OTHER categories and that the log shows a single `[categorize]` call. Clean up any submissions you created.
6. Dry-run the updated workflow logic locally by executing the bash loop against `localhost:3000` with the same `curl`/`jq` commands the YAML uses, and paste the output. If you have `act` available, run the workflow with it; otherwise say so.
7. `npm run lint`, `npm test`, `npm run build` pass.

## When done

Commit on a branch, push, and open a PR against `main` titled `infra: split daily scrape into bounded groups; categorize review-mode sources`. Update `plan.md`: add a Done line under Phase 1 item 1b's runtime note with the measured per-group durations, and remove the "before adding more sources" warning if the split makes it moot.
