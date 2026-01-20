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

---

## Planned Sources

### Tier 2: JavaScript-Rendered (Need Puppeteer)
| Source | URL | Type | Notes |
|--------|-----|------|-------|
| Nyack Library | https://www.nyacklibrary.org/eventscalendar.html#/events/ | Calendar | LocalHop widget |
| Tarrytown Music Hall | https://tarrytownmusichall.org/ | Venue | External ticketing at tickets.tarrytownmusichall.org |

### Tier 3: Unstructured/Special Handling
| Source | URL | Type | Notes |
|--------|-----|------|-------|
| Nyack News and Views | https://nyacknewsandviews.com | Blog | Parse "Weekly Rec" articles |
| ArtsRock | https://artsrock.org/ | Venue | Returns 403, may need alternative approach |
| West Gate Lounge | https://www.facebook.com/WestGateLounge/ | Venue | Facebook page - unreliable scraping |
| Maureen's Jazz Cellar | https://www.maureensjazzcellar.com/ | Venue | Uses Inffuse widget (JS-rendered) |
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
| Village of Nyack | https://www.nyack-ny.gov/ | Official public meetings and park events. |

---

## Music, Nightlife and Performance
Best for: Live bands, jazz, theater, and evening entertainment.

* Maureen's Jazz Cellar: https://www.maureensjazzcellar.com/ - Jazz, cabaret, and classical.
* The Bridge Nyack: https://thebridgenyack.com/ - Nightlife, DJs, and live performances.
* Elmwood Playhouse: https://www.elmwoodplayhouse.com/ - Local theater productions.
* Olde Village Inne (OVI): https://www.nyackovi.com/ - Pub music and open mic nights.

---

## Arts, Culture and Film
Best for: Gallery openings, independent film, and historical tours.

* Edward Hopper House: https://www.edwardhopperhouse.org/ - Art exhibitions and summer garden concerts.
* Rivertown Film Society: https://rivertownfilm.org/ - Independent and documentary screenings.
* Perry Lawson Fine Art: https://www.perrylawsonfineart.com/ - Gallery-specific events.

---

## Kids, Families and Community
Best for: Library programs, youth sports, and local community gatherings.

* The Nyack Center: https://nyackcenter.org/ - Major community festivals and fundraisers.
* Explore Rockland: https://explorerocklandny.com/events/ - Regional events near Nyack Beach and Rockland Lake.
* Palisades Center: https://www.palisadescenter.com/events/ - Large scale commercial events and Levity Live comedy.

---

## Other Venues to Research

| Venue | URL | Status |
|-------|-----|--------|
| Olive's | TBD | Need to find website |
| Piermont Club | https://piermont.club/shop/ | Need to investigate |
| Palisades Center Movies | TBD | Need to find showtimes source |

---

## Ideas / To Investigate

Add new sources here as you discover them:


---

## Notes

- **Priority**: Focus on Tier 1 sources first for MVP
- **Family-friendly**: Tag sources that primarily have family events
- **Frequency**: Most venue calendars update weekly or less
