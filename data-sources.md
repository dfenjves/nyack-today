# Nyack Today - Data Sources

A running list of event and activity sources for the Nyack area.

---

## Active Sources (Built)

### Tier 1: Structured Data (Cheerio-based)
| Source | URL | Type | Status | Notes |
|--------|-----|------|--------|-------|
| Visit Nyack | https://visitnyack.org/calendar/ | Calendar | ✅ Built | The Events Calendar plugin, JSON-LD |
| The Angel Nyack | https://theangelnyack.com/ | Venue | ✅ Built | JSON-LD |
| Eventbrite | https://www.eventbrite.com/d/ny--nyack/events/ | Aggregator | ✅ Built | Schema.org JSON-LD ItemList |
| Levity Live | https://www.levitylive.com/nyack | Venue | ✅ Built | JSON-LD @graph format, COMEDY category |
| Elmwood Playhouse | https://www.elmwoodplayhouse.com/ | Venue | ✅ Built | MEC plugin JSON-LD, THEATER category |
| Rivertown Film | https://rivertownfilm.org/ | Venue | ✅ Built | HTML parsing (no JSON-LD), MOVIES category |
| Village of Nyack | https://www.nyack.gov/ | Government | ✅ Built | RSS feeds, COMMUNITY_GOVERNMENT category |
| Maureen's Jazz Cellar | https://www.maureensjazzcellar.com/ | Venue | ✅ Built | Inffuse calendar API, MUSIC category, fixed timezone handling |

### Tier 2: JavaScript-Rendered (Puppeteer)
| Source | URL | Type | Status | Notes |
|--------|-----|------|--------|-------|
| Explore Rockland | https://explorerocklandny.com/events | Calendar | ✅ Built | The Events Calendar plugin, filtered for Nyack/West Nyack/Upper Nyack only |

---

## Generic sources (config-driven, no code)

Rows in the `Source` table, managed at `/admin/sources`. The generic scraper
(`src/lib/scrapers/generic.ts`) fetches the page, reduces it to readable text,
and runs it through AI extraction — no bespoke scraper file, no deploy. All of
these start in **review mode** (`autoPublish = false`), so their events land in
`/admin/submissions` rather than going live.

Onboarded 2026-09-15. "Events" is the first real run.

| Source | URL | Mode | Events | Notes |
|--------|-----|------|--------|-------|
| Nyack Library | https://www.nyacklibrary.org/eventscalendar.html | PUPPETEER | **40** | LocalHop widget renders in an **iframe** — the main frame is nearly empty, so PUPPETEER mode concatenates every frame. Its Parse API (`api.getlocalhop.com/1`, app id in the embed JS) needs an app-id header and there is no public `.ics`, so no ICAL/JSONLD option. Shows the current month, so coverage rolls forward daily. |
| Edward Hopper House | https://www.edwardhopperhouse.org/calendar.html | PUPPETEER | 5 | Weebly site; CHEERIO returns only the nav. |
| Nyack Chamber of Commerce | https://www.nyackchamber.org/ | CHEERIO | 3 | No calendar page — the homepage carries Farmers Market, Halloween Parade, Holiday Lights. |
| Nyack Center | https://nyackcenter.org/upcoming-events | CHEERIO | 2 | Squarespace; events are in the static HTML. |
| Creative Arts Workshop | https://www.arts-workshop.com/ | CHEERIO | 1 | Wix; one-off events on the homepage, classes live in a booking widget. |
| Big Red Books | https://www.bigredbooks.net/ | — | ❌ disabled | Shopify storefront with no events page (`/pages/events` 404s, sitemap is products only). They announce readings on Instagram — add `@bigredbooks` to `INSTAGRAM_HANDLES` instead. |
| Homebody Books | https://www.homebodybooks.net/events-1-1 | — | ❌ disabled | The Squarespace events page still holds unedited demo content ("Event Five", January 2026 placeholders). Page shape is fine; re-enable once they start using it. |
| Helen Hayes Youth Theatre | https://helenhayesyouththeatre.com/ | — | ❌ disabled | No dated listings on the site; performance dates live in the Arts People ticketing app (`app.arts-people.com/index.php?ticketing=hhy01`), which returns no readable text even rendered. Needs a bespoke approach or hand entry. |

**Fetch modes:** `CHEERIO` (static HTML → text → AI), `PUPPETEER` (render first,
includes iframes), `JSONLD` (schema.org Event data, no AI, falls back to
CHEERIO), `ICAL` (`.ics` feed, no AI, recurrences expanded 60 days), `RSS`
(feed items batched through AI).

**Adding one:** `/admin/sources` → Add source → paste the URL → Test → adjust
mode/defaults → Test again → Save. Start with CHEERIO; if the test comes back
nearly empty, try PUPPETEER. Look for a `.ics` or `/feed` URL first — those
modes skip the AI call entirely and give exact times.

---

## Planned Sources

### Tier 2: JavaScript-Rendered (Need Puppeteer)
| Source | URL | Type | Notes |
|--------|-----|------|-------|
| Nyack Library | https://www.nyacklibrary.org/eventscalendar.html#/events/ | Calendar | LocalHop widget |
| Tarrytown Music Hall | https://tarrytownmusichall.org/ | Venue | External ticketing at tickets.tarrytownmusichall.org |

### Tier 3: Unstructured/Special Handling
| Source | URL | Type | Status | Notes |
|--------|-----|------|--------|-------|
| Nyack News and Views | https://nyacknewsandviews.com/blog/category/nyack-weekender/ | Blog | ✅ Built | Parses most recent Nyack Weekender post; multi-strategy content extraction (h2/h3 headings, bold titles, list items) |
| ArtsRock | https://artsrock.org/ | Venue | Returns 403, may need alternative approach |
| West Gate Lounge | https://www.facebook.com/WestGateLounge/ | Venue | Facebook page - unreliable scraping |
| Edward Hopper House | https://www.edwardhopperhouse.org/ | Venue | Multi-page crawl needed, no JSON-LD |
| Palisades Center | https://www.palisadescenter.com/events/ | Venue | 403 - anti-bot protection |

### Tier 4: APIs
| Source | URL | Type | Notes |
|--------|-----|------|-------|
| Eventbrite API | https://www.eventbrite.com/platform/api | API | Official API |
| Ticketmaster API | https://developer.ticketmaster.com/ | API | Discovery API |

---

## Central Hubs and Government
Best for: Street fairs, official holidays, and community-wide announcements.

| Source | URL | Notes |
| :--- | :--- | :--- |
| Chamber of Commerce | https://www.nyackchamber.org/ | Focuses on Farmers Markets and Street Fairs. |
| Village of Nyack | https://www.nyack.gov/ | ✅ Built - Official public meetings and park events. |

---

## Music, Nightlife and Performance
Best for: Live bands, jazz, theater, and evening entertainment.

* Maureen's Jazz Cellar: https://www.maureensjazzcellar.com/ - Jazz, cabaret, and classical.
* The Bridge Nyack: https://thebridgenyack.com/ - Nightlife, DJs, and live performances.
* Elmwood Playhouse: https://www.elmwoodplayhouse.com/ - Local theater productions.
* Helen Hayes Theater: TBD - Professional theater productions.
* Olde Village Inne (OVI): https://www.nyackovi.com/ - Pub music and open mic nights.
* Olive's Nyack Bar: https://www.olivesnyackbar.com/ - Bar and live music venue.

---

## Arts, Culture and Film
Best for: Gallery openings, independent film, and historical tours.

* Edward Hopper House: https://www.edwardhopperhouse.org/ - Art exhibitions and summer garden concerts.
* Rivertown Film Society: https://rivertownfilm.org/ - Independent and documentary screenings.
* Perry Lawson Fine Art: https://www.perrylawsonfineart.com/ - Gallery-specific events.
* Creative Arts Workshop: TBD - Arts classes and workshops.
* Homebody Books: TBD - Bookstore readings and literary events.
* Big Red Books: TBD - Bookstore readings and events.

---

## Kids, Families and Community
Best for: Library programs, youth sports, and local community gatherings.

* The Nyack Center: https://nyackcenter.org/ - Major community festivals and fundraisers.
* Palisades Center: https://www.palisadescenter.com/events/ - Large scale commercial events and Levity Live comedy.
* Nyack Library: https://www.nyacklibrary.org/eventscalendar.html#/events/ - Library programs and community events.
* Peas Playcare: TBD - Children's play space and events.
* Nursery School of the Nyacks: TBD - Preschool events and programs.

---

## Other Venues to Research

| Venue | URL | Status |
|-------|-----|--------|
| Olive's Nyack Bar | https://www.olivesnyackbar.com/ | Need to investigate scraping approach |
| Piermont Club | https://piermont.club/shop/ | Need to investigate |
| Palisades Center Movies | TBD | Need to find showtimes source |
| Scott and Joe | TBD | Need to identify venue type and find website |
| Marydell | TBD | Need to identify venue type and find website |

---

## Ideas / To Investigate

Add new sources here as you discover them:
Rockland Chess CLub (rocklandchess.org)


---

## Notes

- **Priority**: Focus on Tier 1 sources first for MVP
- **Family-friendly**: Tag sources that primarily have family events
- **Frequency**: Most venue calendars update weekly or less
