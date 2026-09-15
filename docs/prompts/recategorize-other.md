# Re-categorize "OTHER" events with AI, then make categorization AI-assisted at ingest

## Context

Nyack Today (Next.js 16 App Router, Prisma, Supabase Postgres). Read `CLAUDE.md` and `plan.md` first. This is Phase 0, item 5 of `plan.md`.

Today 23% of upcoming events are filed under `OTHER`, which makes the public category filters feel broken and is one of the Phase 0 "done when" gates (target: under 10%). Categorization currently comes from `guessCategory()` in `src/lib/utils/categories.ts`, a keyword matcher, used by about half the scrapers (see `grep -l guessCategory src/lib/scrapers/*.ts`). The AI-ingest paths (email, Discord, Instagram in `src/lib/ai/client.ts`) extract events but their `ExtractedEvent` type in `src/lib/ai/types.ts` has no category field at all, so those land in `OTHER` or whatever the processor guesses.

Two deliverables: a one-off backfill script, and a shared classifier used at ingest so the problem doesn't come back.

## Deliverable 1: shared AI classifier

Create `src/lib/ai/categorize.ts` exporting:

```ts
export interface CategorizeInput {
  title: string
  description?: string | null
  venue?: string | null
  sourceName?: string | null
}
export interface CategorizeResult {
  category: Category
  isFamilyFriendly: boolean | null   // null = model wasn't confident
  confidence: 'high' | 'medium' | 'low'
}
export async function categorizeEvent(input: CategorizeInput): Promise<CategorizeResult>
export async function categorizeEvents(inputs: CategorizeInput[]): Promise<CategorizeResult[]>  // batches of ~20 in one call
```

Rules:
- Reuse the provider/config plumbing already in `src/lib/ai/client.ts` (`getAIConfig`, the OpenAI/Anthropic fallback pattern). Do not add a new SDK or env var. Read that file before writing anything; match how it builds requests and handles errors.
- Use a cheap model for this (the config's default is fine; if it's a large model, add a `AI_CATEGORIZE_MODEL` env var with a cheap default and document it in `README.md`'s env section). This runs on every scraped event.
- The prompt must list all 11 `Category` values with one-line definitions drawn from `categoryLabels` in `src/lib/utils/categories.ts`, and give 2–3 Nyack-specific examples per category (e.g. "Jazz at Maureen's" → MUSIC; "Village Board of Trustees meeting" → COMMUNITY_GOVERNMENT; "Storytime at the library" → FAMILY_KIDS; "Trivia night at Olive's" → FOOD_DRINK; "Chess club meetup" → SPORTS_RECREATION). Instruct it to use OTHER only when nothing else fits.
- Ask for JSON output and validate it: if the returned category isn't in the enum, fall back to `guessCategory()` with `confidence: 'low'`.
- Cache by content hash (sha1 of title + venue + first 200 chars of description) in an in-memory `Map` for the process lifetime, so re-scraping the same events daily is free. No DB cache table for now.
- Never throw. On any AI failure return `guessCategory()` with `confidence: 'low'`.

## Deliverable 2: use it at ingest

In `src/lib/scrapers/index.ts`, `saveEvent()` is where every scraped event enters the DB. Hook categorization there, not in the 17 individual scrapers:

- Before insert of a **new** event: if the scraper supplied `OTHER`, or the scraper is one that never sets a real category (decide by checking which scrapers hard-code a category vs. call `guessCategory`; keep a small allowlist constant of "trusted-category" scrapers like Levity Live = COMEDY, Elmwood = THEATER, Rivertown = MOVIES, Maureen's = MUSIC whose hard-coded category should win), call `categorizeEvents` and apply the result. Also apply `isFamilyFriendly` only when the scraper's value is `false` and the classifier says `true` with `confidence: 'high'`; never flip `true` to `false`.
- Batch: collect the new events for a scraper run and classify in one `categorizeEvents` call before the insert loop, rather than one AI call per event. Restructure the loop in `runAllScrapers` / `runScraper` minimally to allow that.
- On **update** of an existing event (the `updated` path): do not re-categorize. Admins may have hand-corrected the category; leave it.
- The AI-ingest processors (`src/lib/gmail/processor.ts`, `src/lib/discord/processor.ts`, `src/lib/instagram/processor.ts`) create `EventSubmission` rows, not events. Add the classifier call there too so the submission arrives pre-categorized for the admin reviewer. Find the one place in each processor where the `category` field is set on the submission.

## Deliverable 3: one-off backfill script

`scripts/recategorize-other.ts`, run with `npx tsx scripts/recategorize-other.ts [--dry-run] [--all]`. Follow the style of `scripts/fix-timezone-events.ts` (preview first, then act).

- Default scope: non-hidden events with `category = OTHER` and `startDate >= now`. `--all` widens to every non-hidden future event regardless of category, for a full re-audit (report what would change, don't apply unless `--apply-all` is also passed).
- `--dry-run` prints a table: id, title, venue, current → proposed, confidence. No writes.
- Without `--dry-run`: apply only `high` and `medium` confidence changes. Print the `low` ones for manual review.
- Batch via `categorizeEvents`, 20 at a time, with a short delay between batches.
- Also flip `isFamilyFriendly` to `true` where the classifier says so with `high` confidence.
- Print a before/after summary: count of OTHER before, after, and the share of upcoming events that is OTHER after, so it can go straight into `plan.md`.
- Note in the script header that it needs `DATABASE_URL` from `.env.local` (see how other scripts in `scripts/` load env).

## Constraints

- No Prisma schema changes.
- Do not change `/api/events` or anything in `docs/public-api.md`.
- Do not change `guessCategory()`'s behavior; it stays as the fallback.
- Do not modify individual scraper files except to remove now-redundant `guessCategory` calls if, and only if, that's a trivial cleanup. Prefer leaving them.
- TypeScript strict, `npm run lint` and `npm run build` pass.
- Keep total added AI cost visible: log one line per scraper run like `[categorize] 14 events, 1 API call, 9 cached`.

## Verification (run and report real output)

1. `npx tsx scripts/recategorize-other.ts --dry-run` prints the proposal table. Eyeball 10 rows and report whether the proposals look right. If more than ~2 of 10 look wrong, fix the prompt before applying.
2. Run it for real. Report before/after OTHER counts and the new OTHER share of upcoming events.
3. Trigger one scraper that tends to produce OTHER (`Explore Rockland` or `Patch Nyack`) via `POST /api/scrape?scraper=<name>` with the `x-scraper-key` header (check `src/app/api/scrape/route.ts` for the exact param and header) and confirm new events arrive categorized, with the `[categorize]` log line showing a single API call.
4. Trigger it again immediately and confirm the log shows cache hits and zero API calls.
5. Confirm an admin-edited category survives a re-scrape: change one event's category in `/admin/events`, re-run its scraper, verify the category is unchanged.
6. Open `/admin/pulse` and report the new "Other" chip value.
7. Unit-test the JSON validation and fallback path in `categorize.ts` (bad JSON, unknown category, provider throws) with whatever test runner the repo has; if none, add a minimal `node --test`-compatible test and a `npm test` script.

## When done

Update `plan.md`: add a "Done" line under Phase 0 item 5 with the date and the before/after OTHER share, and update the OTHER row in the §1 metrics table.
