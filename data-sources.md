# Nyack Today - Data Sources

A running list of event and activity sources for the Nyack area.

---

## Active Sources (MVP)

### Tier 1: Structured Data (Easy to scrape)
| Source | URL | Type | Notes |
|--------|-----|------|-------|
| Visit Nyack | https://visitnyack.org/calendar/ | Calendar | The Events Calendar plugin, JSON-LD |
| The Angel Nyack | https://theangelnyack.com/ | Venue | Clean event listings |
| Levity Live | https://www.levitylive.com/nyack | Venue | Schema markup |
| Eventbrite | https://www.eventbrite.com/d/ny--nyack/events/ | Aggregator | Schema.org JSON-LD, API available |

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

### Tier 4: APIs
| Source | URL | Type | Notes |
|--------|-----|------|-------|
| Eventbrite API | https://www.eventbrite.com/platform/api | API | Official API |
| Ticketmaster API | https://developer.ticketmaster.com/ | API | Discovery API |

---

## Other Venues to Research

| Venue | URL | Status |
|-------|-----|--------|
| Maureen's Jazz Cellar | TBD | Need to find website |
| Olive's | TBD | Need to find website |
| Nyack Center | TBD | Need to find website |
| Piermont Club | https://piermont.club/shop/ | Need to investigate |
| Palisades Center Movies | TBD | Need to find showtimes source |

---

## Community/Government Sources

| Source | URL | Status |
|--------|-----|--------|
| Village of Nyack | https://www.nyack.gov/calendar | Need to find official site |
| Nyack Chamber of Commerce | TBD | Need to find website |

---

## Ideas / To Investigate

Add new sources here as you discover them:

- Edward Hopper House
-
-

---

## Notes

- **Priority**: Focus on Tier 1 sources first for MVP
- **Family-friendly**: Tag sources that primarily have family events
- **Frequency**: Most venue calendars update weekly or less
