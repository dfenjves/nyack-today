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
