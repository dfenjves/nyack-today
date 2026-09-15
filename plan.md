# Nyack Today — Plan to become the go-to source for what's going on in Nyack

**Status:** Active plan of record (supersedes the original implementation plan, now archived at `docs/archive/initial-implementation-plan.md`)
**Owner:** Danny
**Written:** 2026-09-14
**Horizon:** ~6 months (through March 2027), reviewed monthly

---

## 1. The goal, made concrete

"Go-to" means three things, each observable:

1. **Residents reach for it first.** When someone in the Nyacks wonders "what's going on tonight / this weekend?", they open nyacktoday.com, the app, or the email before they open Facebook or Google.
2. **Organizers post to it by default.** Venues, nonprofits, the library, the Village, and the schools treat listing on Nyack Today as part of announcing an event.
3. **Other local institutions point to it.** The Chamber, Nyack News & Views, the Village site, and community groups link to or embed it as *the* calendar.

None of that happens unless the underlying promise holds: **if it's happening in Nyack, it's on Nyack Today, and the details are right.** Coverage and correctness come before growth. A wrong start time costs more trust than a missing event.

### North-star metric

**Weekly Active Locals (WAL)**: unique visitors per week across web + app, from the NY metro region. Everything below is in service of this number.

| Metric | Baseline (Sept 2026) | 3-month target | 6-month target |
|---|---|---|---|
| Weekly Active Locals | *unknown — measure first* | 500 | 1,500 |
| Events listed for "tonight" (daily minimum) | 2 | ≥ 5 every day | ≥ 8 every day |
| Events this week | 33 | 75 | 120 |
| Categories with ≥ 1 event this week | 8 of 11 | 10 of 11 | 11 of 11 |
| FAMILY_KIDS events per 30 days | 1 | 25 | 50 |
| Events categorized OTHER (share) | 23% | < 10% | < 5% |
| Thin days (< 5 events) in the next 14 days | 11 of 14 (0 empty) | 0 | 0 |
| Email subscribers | 10 active (+1 this week) | 400 | 1,000 |
| iOS devices registered | 0 active | 100 | 400 |
| Organizer submissions per week | ~2 | 5 | 10 |
| Local sites linking to nyacktoday.com | *unknown* | 5 | 12 |

The 6-month WAL target is roughly one in eight people in the three Nyacks (population ~12,100) showing up every week. That is what "go-to" looks like numerically.

Baseline figures come from the live API on 2026-09-14 (`/api/events?date=…` counts and a 100-event sample of the 30-day window). Items marked *unknown* are the first thing Phase 0 measures.

Subscriber, device, and thin-day baselines come from `/admin/pulse` on 2026-09-15. The same reading showed 32 events in the next 7 days, 10 of 11 categories this week, and OTHER at 28% of the 14-day window. It also showed 10 submissions in the last 7 days, but most came from AI ingest (Discord, email, Instagram), not organizers, so the ~2 organizer figure stands. Sources flagged that day: Email Newsletters (no success since 2026-03-24) and Instagram (since 2026-08-25) are stale; Visit Nyack, Eventbrite, and Rivertown Film ran but found 0 events.

---

## 2. Where we are today (honest read)

**Strengths (already built, working in production):**
- 17 automated scrapers plus AI ingest from email newsletters, a local Discord server, and Instagram accounts. Daily scrape cron, dedup, admin review queue.
- Public submission form with AI poster extraction. Admin dashboard with edit/hide/dedup/merge.
- Weekly Thursday email digest (Resend) with an AI-written intro.
- Event detail pages with schema.org `Event` JSON-LD, share buttons, add-to-calendar.
- iOS backend complete: stable event IDs, device registration, daily "Tonight" push cron. Public API contract frozen in `docs/public-api.md`.
- Considered visual identity (Fraunces + Plus Jakarta Sans, forest/terracotta/oat palette).

**Gaps that block "go-to":**
- **Thin coverage.** Two events tonight, four tomorrow. Half of the 30-day window comes from three music venues (Maureen's, The Angel, Olive's). One family event in 30 days. No library, Nyack Center, Hopper House, Helen Hayes, Chamber, schools, houses of worship, or civic meetings beyond the Village RSS. Eleven venues are sitting in open GitHub issues (#17, #35–#41, #55).
- **Categorization is weak.** Nearly a quarter of events land in OTHER, which makes the category filters feel broken.
- **Location errors.** Issue #97: non-Nyack events show as Nyack. Venue names are free text, so nothing is normalized.
- **No outbound distribution.** The site ingests from Discord and Instagram but never posts back. The digest is weekly only. The iOS app is not on the App Store.
- **Invisible to search.** The sitemap lists three URLs. There are no landing pages for "things to do in Nyack this weekend", no venue pages, no category pages. Event pages exist but are not in the sitemap.
- **No measurement.** Vercel Analytics gives pageviews only. No custom events, no cohort of returning visitors, no subscriber/device counts surfaced anywhere. We cannot tell whether we are growing.
- **Partner integration is nil.** No embeddable widget, no iCal/RSS feed, no way for Nyack News & Views or the Chamber to carry the calendar.
- **Community feedback we haven't acted on.** Issue #23 asks for civic votes, board meetings, and volunteer opportunities. Issue #45 asks for a playful Sunday Discord digest. Issue #17 lists family venues to connect with.

---

## 3. Strategy: five pillars, sequenced

| Pillar | One-line thesis | Primary phase |
|---|---|---|
| **A. Measure** | You can't become the go-to without knowing if you're becoming it. | 0 |
| **B. Coverage & correctness** | "If it's happening in Nyack, it's here, and it's right." Fill tonight first. | 1 |
| **C. Findability** | Win the Google searches locals already make. | 2 |
| **D. Daily habit & distribution** | Push the content to where people already are: phone, inbox, Instagram, Discord, partner sites. | 3 |
| **E. Supply side** | Make organizers post directly and feel ownership. | 4 |
| **F. Beyond events** | Civic meetings, votes, volunteering, alerts — the rest of "what's going on in town." | 5 |

Phases overlap. The dependency that matters: **Phase 1 (coverage) gates Phases 3 and 4.** Do not run outreach or push growth while "tonight" shows two events; every new visitor who sees an empty page is a lost habit.

---

## 4. Phases

### Phase 0 — Measure and stabilize (weeks 1–2, by ~Sept 28)

**Outcome:** We know the baseline for every metric in §1 and the data we already show is trustworthy.

Tasks:
1. **Custom product analytics.** Add an `AnalyticsEvent` model and `POST /api/analytics` (anonymous session id in localStorage, no PII). Instrument: date-tab click, category filter, free/family toggles, event-card click, outbound source click, subscribe, share. Keep Vercel Analytics for traffic/referrers. `src/lib/utils/analytics.ts`, `src/components/AnalyticsProvider.tsx`.
2. **Admin "Pulse" page** (`/admin/pulse`): WAL (from Vercel API or Plausible if adopted), subscriber count, active device count, submissions/week, and a **14-day coverage grid** (events per day × category). Red-flag any day with < 5 events and any scraper whose last success is > 3 days old.
3. **Quiet-day alert.** After the 6 AM scrape, if tomorrow has < 5 events, post to the Discord webhook. Turns thin days into a to-do instead of a surprise.
4. **Fix the trust bugs.** #97 (non-Nyack events shown as Nyack), #28 (recurring events always in upcoming), #103 (bottom nav clips last card), #105 (Escape on date sheet). Merge PR #110.
5. **AI re-categorization pass.** One-off script over all `OTHER` events using the existing `src/lib/ai` client; then make categorization AI-assisted at ingest for every scraper (`src/lib/scrapers/utils.ts`), not just email/Discord/Instagram.
6. **Google Search Console + Business Profile.** Verify the domain, submit the sitemap, claim "Nyack Today". Zero code, high leverage. *(Human step — Danny.)*

Done when: `/admin/pulse` shows real numbers for every row in the §1 table, and OTHER share is under 10%.

**Sequencing note (2026-09-15).** The Pulse baseline showed 11 of 14 days thin, 10 subscribers, 0 devices. Coverage is the bottleneck, not measurement, so the order changes:
- Next: #5 re-categorization (prompt: `docs/prompts/recategorize-other.md`) and Phase 1 item 1b, the generic AI source scraper (prompt: `docs/prompts/generic-source-scraper.md`). They touch different files and can run as parallel sessions.
- Deferred: #3 quiet-day alert. With 11 thin days it would fire every morning and train us to ignore it. Build it once thin days are under 3 per fortnight. #1 analytics moves after 1b; the baseline it would capture is the pre-coverage number and would only need re-baselining anyway.
- Human, this week: #6 Search Console + Business Profile; hand-enter 15–20 standing weekly events via `/admin/events/new` (Phase 1 item 1d) since that fills Tuesday nights with zero code; start the Instagram Business / Meta app review.

- **Done 2026-09-15 — #2 Admin Pulse page.** `/admin/pulse` + `GET /api/admin/pulse`: 14-day Eastern-time coverage grid (per-day totals verified to match the public site's single-day query), source health (never/stale/zero/ok, `partial` counts as success), and subscriber/device/submission counts. Thresholds live in `PULSE_THRESHOLDS` (`src/lib/utils/pulse.ts`) for the quiet-day alert (#3) to reuse. WAL tile stays "—" until #1 ships.

---

### Phase 1 — Coverage: never an empty "tonight" (weeks 2–6, by ~Oct 26)

**Outcome:** Tonight always has ≥ 5 events, every category has something weekly, family events are plentiful.

**1a. A `Venue` model (foundation for everything after this).**
Free-text `venue` strings block location fixes, venue pages, organizer ownership, and dedup. Add `Venue { id, slug, name, address, city, lat, lng, websiteUrl, instagramHandle, isNyackProper, aliases[] }`, an `Event.venueId` FK (nullable, keep `venue` string for backward compatibility per the API contract), and an admin "resolve venue" UI that matches free text to venues via aliases + fuzzy match. Backfill the top 40 venues by hand.

**1b. Generic AI source scraper (the leverage move).**
Bespoke scrapers cost half a day each and break. Build one config-driven scraper: a `Source` row in the DB `{ name, url(s), fetchMode: 'cheerio'|'puppeteer'|'ical'|'rss', defaultCategory, defaultVenueId, enabled }`. It fetches the page, strips it to readable text, and runs it through the existing AI extraction prompts (`src/lib/ai/prompts.ts`), then dedups exactly like other scrapers. Add an admin "Sources" page to add/test/disable a source with no code deploy. Target: onboard a long-tail venue in 10 minutes.

- **Done 2026-09-15 — 1b. Generic AI source scraper.** `Source` model + `src/lib/scrapers/generic.ts` (fetch modes CHEERIO / PUPPETEER / ICAL / RSS / JSONLD, robots.txt respected, 3 URLs per source), a fourth AI entry point `extractEventsFromWebPage`, and `/admin/sources` with a true dry-run Test button. **8 sources onboarded, 5 working, 51 events found on their first run (45 new submissions for review).** Nyack Library alone accounts for 40 — its LocalHop widget lives in an iframe, so PUPPETEER mode reads every frame. Big Red Books (Shopify, no events page), Homebody Books (Squarespace demo placeholders), and Helen Hayes Youth Theatre (dates only inside the Arts People ticketing app) are seeded but disabled with notes; the two bookstores belong in 1e's Instagram list. All five start in review mode, so the thin-day count doesn't move until Danny works through `/admin/submissions`. **Runtime warning:** the nightly run was 116–130 s for 17 scrapers and the generic sources add ~112 s (Nyack Library 70 s), putting the total near 230–245 s against Vercel's 300 s cap. Splitting the cron into two invocations — static scrapers and generic sources — is now the next infrastructure task, before more sources are added.

**1c. Onboard the high-yield sources**, in this order (biggest gap first):

| Source | Why | Approach |
|---|---|---|
| Nyack Library | The single largest family/kids/classes source in town | LocalHop widget — look for its JSON/iCal endpoint first; Puppeteer fallback |
| Nyack Center | Community festivals, kids programs | Generic scraper |
| Edward Hopper House | Openings, jazz in the garden, art classes | Generic scraper (multi-page) |
| Helen Hayes Theater / Nyack Center stage | Theater | Generic scraper |
| Nyack Chamber of Commerce | Street fairs, farmers market, sidewalk sales | Generic scraper + hand-entered recurring farmers market |
| Nyack Public Schools + BOE calendar | Concerts, games, board meetings; parents are the core audience | iCal/RSS if available |
| Rockland Center for the Arts | Classes, exhibits (scraper exists, yields 1 event — fix) | Fix existing |
| Big Red Books, Homebody Books | Readings, storytime | Generic scraper / Instagram handles |
| Creative Arts Workshop, Peas Playcare, Nursery School of the Nyacks | Family classes and events (#17) | Instagram handles + generic scraper |
| Scott & Joe, Maura's Kitchen, Nyack Food Tours, Marydell | Food & drink, retreats (#40, #41, #55) | Instagram handles |
| Houses of worship (community suppers, concerts, holiday events) | Underserved, family-heavy | Generic scraper / email newsletters |
| Nyack Park Conservancy, Hudson River groups, Rockland Volunteer Center | Outdoors, volunteering (#23) | Generic scraper |
| Tarrytown Music Hall, ArtsRock | Big-ticket music nearby | Ticketmaster Discovery API for TMH; ArtsRock via newsletter ingest |
| Palisades Center + Levity Live | Comedy, mall events, movies | Levity exists; movies via a showtimes API rather than the blocked site |

**1d. Standing weekly events.**
Trivia nights, open mics, jazz sessions, farmers market, library storytime, yoga in the park. These are what fills "tonight" on a Tuesday. Curate 20–30 recurring events by hand using the existing `isRecurring` fields; review quarterly. Once #28 is fixed they always surface.

**1e. Expand Instagram monitoring.** Many Nyack businesses only announce on Instagram. Grow `INSTAGRAM_HANDLES` from the current list to ~40 accounts (every venue in 1c that has one). Watch Apify cost; cap posts per handle. As of Sept 2026 the Apify call is rate-limited to once every 5 days with a 5-day lookback (`INSTAGRAM_SCRAPER_INTERVAL_DAYS`) because daily runs burned credits too fast; revisit the interval and `INSTAGRAM_POSTS_PER_HANDLE` as handles grow.

Done when: the coverage grid on `/admin/pulse` shows no red days for two consecutive weeks and FAMILY_KIDS has ≥ 25 events in the next 30 days.

---

### Phase 2 — Findability: win the searches locals already make (weeks 4–10, by ~Nov 23)

**Outcome:** Searching "things to do in Nyack this weekend", "Nyack events tonight", "Nyack live music", or any venue name lands on nyacktoday.com above Facebook and Eventbrite.

Tasks:
1. **Landing pages** (server-rendered, ISR ~1 hour, each with a real intro paragraph and `ItemList` JSON-LD):
   - `/tonight`, `/this-weekend`, `/this-week`, `/free`, `/family`
   - `/venues/[slug]` — one per Venue, with upcoming events, address/map, website, Instagram (requires 1a)
   - `/c/[category]` — e.g. `/c/live-music`, `/c/comedy`, `/c/kids`
   - `/nyack-events` monthly archive pages later if traffic warrants
2. **Sitemap from the database.** Every event page, venue page, and landing page in `src/app/sitemap.ts`. Remove events from the sitemap once past.
3. **Rich results.** Verify `Event` JSON-LD passes Google's Rich Results Test; add `offers`, `image`, `organizer`, and `location` with a `PostalAddress` (from Venue). Google surfaces these directly in search as event cards — that alone can be the biggest traffic source.
4. **Free-text search on the web** (`?q=`) — the app has it, the site doesn't. Add to `/api/events` as a new param (append-only contract) and a search box in the header.
5. **Performance pass.** Issue #80 was closed but the home page is client-heavy. Target LCP < 2.5 s on a mid-range phone; Google ranks on it.
6. **Title/description hygiene.** Per-page titles like "Things to do in Nyack this weekend (Sept 19–21) | Nyack Today" that update automatically.

Done when: Search Console shows impressions for the target queries and ≥ 3 landing pages in the top 10.

---

### Phase 3 — Daily habit and distribution (weeks 6–14, by ~Dec 21)

**Outcome:** The content reaches people every day without them visiting. Each channel points back to the site/app.

Tasks, roughly in order of effort-to-impact:
1. **Sunday Discord digest bot** (#45). Reuse the digest generator; post a playful week-ahead write-up with links to a channel webhook every Sunday at 4 PM. Half a day of work, immediately visible in the one community space we already ingest from.
2. **Daily "Tonight in Nyack" Instagram post.** Generate a branded image at `/api/social/tonight-image` (same `ImageResponse` infra as `opengraph-image.tsx`) with tonight's top 3–5 events, post via the Instagram Graph API at 4 PM. Requires an Instagram Business account linked to a Facebook Page *(human step — Danny)*. Also produce a Stories-sized variant. Post copy is AI-drafted from the same prompt pattern as the digest; keep the golden-set review discipline from the iOS PRD.
3. **Auto-drafted Facebook-group post.** Groups can't be automated safely, but an admin button "Draft this weekend's post" producing copy + image to paste into Nyack Community Forum / parent groups turns a 30-minute chore into 2 minutes weekly.
4. **Email upgrades.** (a) Daily "Tonight" option next to weekly, chosen at signup; (b) per-subscriber category/family preferences (issue #58 asked for filtering); (c) referral line "Forward to a neighbor"; (d) resend the weekly on Friday morning to non-openers. Subscriber count and open rate on `/admin/pulse`.
5. **Public feeds.** `/api/feed.ics` (subscribe in Google/Apple Calendar, with filters as query params) and `/feed.xml` RSS. This is how power users and partner sites pull us in.
6. **Embeddable widget.** `/embed?date=weekend&venue=…` iframe plus a one-line script snippet. Offer it to Nyack News & Views, the Chamber, the Village, and each venue for their own events ("your events, on your site, free").
7. **iOS app to the App Store.** The backend is done; finish the Expo app per `ios-app-prd.md` Phase 1, TestFlight with 10 locals, then App Store. Add "Nyack Today" to Android via Expo once iOS is stable. Add Smart App Banner on the website.
8. **Web push (PWA).** For people who won't install an app: "Notify me about tonight" opt-in using the existing push infrastructure. Cheap once iOS push exists.

Done when: three outbound channels run automatically without Danny touching them for two weeks, and subscribers + devices are growing week over week.

---

### Phase 4 — Supply side: organizers post by default (weeks 10–18, by ~Jan 18)

**Outcome:** Venues and organizers submit directly, keep their listings accurate, and promote their Nyack Today link.

Tasks:
1. **Submission flow polish.** Sections and progress (#101), upload button fix (#102), poster-first flow ("drop your flyer, we'll fill in the form"), submit multiple dates at once (already modeled via `additionalDates`).
2. **Organizer accounts-lite.** Magic-link email login (no passwords). An organizer sees their own submissions, edits them, uploads new images, and adds future events with their venue prefilled. Ties to `Venue` (1a). Keeps the "no accounts" stance for readers; only organizers log in.
3. **Close the loop.** When a submission is approved, email the organizer the public URL, a share image, and the embed snippet. Approved organizers get "auto-approve" after 3 clean submissions.
4. **Outreach campaign** *(human, with drafted materials)*: a one-page PDF and email template — "Nyack Today lists your events for free; here's your venue page; here's a QR code for your window." Target the 30 venues in Phase 1c plus the library, Village, Chamber, and schools. Track in a simple `outreach.md` or a sheet: contacted / responded / linking / submitting.
5. **Partnerships with institutions.** Ask the Chamber, the Village, the Library, and Nyack News & Views to link to nyacktoday.com as *the* calendar and, ideally, embed the widget. Offer to be their calendar backend.
6. **Physical presence.** QR table tents and window stickers ("What's on in Nyack tonight?") for coffee shops, the library, the bookstores. Print run is cheap; place 25.
7. **Featured/marquee slots.** `isMarquee` already exists. Use it editorially (Danny picks 2–3 per week). Do not sell it yet.

Done when: ≥ 5 organizer submissions per week arrive without prompting and ≥ 5 local sites link to us.

---

### Phase 5 — Beyond events: the rest of "what's going on" (months 4–6, by ~March 2027)

**Outcome:** Nyack Today answers the civic and practical questions too, without becoming a news site.

This is where issue #23's feedback lands: residents want to know about board votes, public hearings, and volunteer opportunities. These are events too, just underserved ones. Keep scope tight.

Tasks:
1. **Civic section.** Public meetings and hearings for the Village of Nyack, Upper Nyack, South Nyack, Orangetown/Clarkstown items affecting Nyack, and the Nyack BOE — with agenda links and a one-line AI summary ("Vote on cell-phone policy for middle school"). Ingest via the existing Village RSS scraper, extended to the other boards; category `COMMUNITY_GOVERNMENT`, plus a `civicType` tag (meeting / hearing / vote / election).
2. **Volunteer opportunities.** A `VOLUNTEER` category or tag; sources: Nyack Center, Rockland Volunteer Center, Keep Rockland Beautiful, park cleanups, houses of worship. Family-friendly flag matters here.
3. **Alerts and closures.** Parades, road closures, parking changes, street-fair days, storm advisories from the Village. Surfaced as a banner on the home page and via push (opt-in, with the "not an official emergency channel" disclaimer from the iOS PRD).
4. **"The Nyacks", officially.** Treat Nyack, Upper Nyack, South Nyack, and West Nyack as home turf in copy, filters, and the location toggle. The audience already thinks of it that way.
5. **Seasonal guides** (light editorial, AI-drafted, Danny-edited): Halloween in Nyack, Holiday season, Summer on the river, Farmers-market season. Each is an SEO landing page that refreshes yearly.

Explicitly **not** in this plan: restaurant/business directory, monetization, news reporting, user comments. Revisit only once the §1 targets are met.

---

## 5. Operating cadence

Being the go-to is an operations job as much as a build job. Automate everything that can be automated; the rest goes on a fixed schedule so it actually happens.

| When | What | Owner |
|---|---|---|
| Daily 6 AM | Scrape runs; quiet-day alert if tomorrow is thin. Instagram/Apify only every 5 days | automated |
| Daily 4 PM | Instagram "Tonight" post; iOS/web push | automated |
| Mon (15 min) | Check `/admin/pulse`; fix red scrapers; add standing events for thin days | Danny |
| Thu 9 AM | Weekly digest email | automated |
| Fri (10 min) | Paste the drafted weekend post into Facebook groups | Danny |
| Sun 4 PM | Discord digest | automated |
| Weekly (30 min) | Review submission queue; reply to organizers; 2 outreach emails | Danny |
| Monthly (1 hr) | Update the §1 metrics table in this file; re-prioritize next phase | Danny |

---

## 6. Risks and how we handle them

| Risk | Mitigation |
|---|---|
| Scraper rot: sources change markup, silently go to zero | Coverage grid + stale-source alerts (Phase 0); generic AI scraper is markup-agnostic (1b); a scraper returning 0 for 3 days is a red flag, not silence |
| Wrong data erodes trust faster than missing data | Venue normalization (1a); AI extraction always through review for new sources until 3 clean runs; one-tap "report a problem" on event pages routed to the admin queue |
| Solo-founder bandwidth | Each phase has a "done when" gate; cadence in §5 caps recurring work at ~1.5 hrs/week; Claude Code sessions take the coding items, Danny takes the human items |
| AI/Apify/Vercel costs grow with sources and channels | Track monthly spend on `/admin/pulse`; cap Instagram posts-per-handle; cache AI extraction by content hash so re-scrapes are free |
| Instagram/Meta API access friction | Business account + app review is a known multi-week process; start it in Phase 0 so it's ready for Phase 3 |
| Scope creep (news, businesses, monetization) | §4 Phase 5 lists explicit non-goals; iOS PRD already fences Phases 2–4; anything else needs a metric it moves |
| Breaking the public API used by installed apps | `docs/public-api.md` is append-only; every new capability is a new param or endpoint |
| Scraping terms of service | Prefer official feeds (iCal, RSS, Ticketmaster/Eventbrite APIs) and organizer submissions; scrape only public calendars; honor robots.txt |

---

## 7. Decisions needed from Danny

1. **Analytics tool.** Stay on Vercel Analytics + our own event table (free), or add Plausible (~$9/mo) for WAL and referrers? Plan assumes the free option; revisit if the Vercel API is too limited for WAL.
2. **Instagram Business account** for @nyacktoday linked to a Facebook Page, and starting Meta app review now.
3. **Apple Developer account** status (blocks Phase 3 step 7). Android via Expo after iOS is stable: yes/no?
4. **Geography.** Confirm "the Nyacks" (Nyack, Upper, South, West) as home turf in copy and filters, with Rockland/Tarrytown as "nearby".
5. **Civic scope.** Meetings, hearings, votes, and volunteering: yes. Political rallies and protests: only when submitted by organizers and reviewed. Confirm.
6. **Outreach voice.** Who signs the venue outreach email — "Danny, a Nyack resident who built this", not "the Nyack Today team". Recommended: Danny, personal.

---

## 8. Immediate next steps (this week)

1. Build `/admin/pulse` with the coverage grid and subscriber/device counts (Phase 0 #2).
2. Add the `AnalyticsEvent` model and instrument the home page (Phase 0 #1).
3. Run the OTHER re-categorization script (Phase 0 #5).
4. Fix #97 and #28; merge PR #110.
5. Danny: Search Console + Google Business Profile; start the Instagram Business / Meta app review; check Apple Developer status.
6. Investigate the Nyack Library LocalHop widget for a feed endpoint (unblocks the biggest family source).

Update this file as phases complete. Move finished tasks to a "Done" line under each phase rather than deleting them, so the history stays readable.
