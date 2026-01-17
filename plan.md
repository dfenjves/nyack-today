# Nyack Today - Technical Implementation Plan

## Overview
A mobile-friendly events aggregator for Nyack, NY that pulls from 15+ local sources, emphasizes "what's happening tonight," and includes an admin dashboard for data management.

---

## Architecture Summary

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Data Sources   │────▶│  Scraper Layer   │────▶│    Database     │
│  (15+ sources)  │     │  (Daily cron)    │     │  (PostgreSQL)   │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                        ┌──────────────────┐              │
                        │  Admin Dashboard │◀─────────────┤
                        │  (/admin)        │              │
                        └──────────────────┘              │
                                                          │
                        ┌──────────────────┐              │
                        │  Public Frontend │◀─────────────┘
                        │  (Next.js SSR)   │
                        └──────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14+ (App Router), React, Tailwind CSS |
| Backend | Next.js API Routes / Server Actions |
| Database | PostgreSQL via Supabase |
| ORM | Prisma |
| Scraping | Node.js scripts + Cheerio (static) + Puppeteer (JS-rendered) |
| Scheduling | GitHub Actions (daily cron) or Netlify Scheduled Functions |
| Hosting | Netlify |
| Auth (Admin) | Simple password protection |

---

## Decisions Made

1. **Database hosting**: Supabase (PostgreSQL) - easy setup, good free tier, nice dashboard
2. **Admin auth**: Simple password protection - single shared password for /admin routes
3. **"Always Available" data**: Manual curation via admin dashboard
4. **Color palette**: Warm sunset tones - oranges, warm yellows, Hudson River sunset vibe

---

## Data Model

### Event
```typescript
{
  id: string (uuid)
  title: string
  description: string | null
  startDate: DateTime
  endDate: DateTime | null
  venue: string
  address: string | null
  city: string (default: "Nyack")
  isNyackProper: boolean (true if in Nyack village)
  category: Category
  price: string | null (e.g., "Free", "$20", "$15-$30")
  isFree: boolean
  isFamilyFriendly: boolean
  sourceUrl: string
  sourceName: string (e.g., "Visit Nyack", "Levity Live")
  imageUrl: string | null
  isHidden: boolean (for admin to hide bad data)
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Activity (Always Available)
```typescript
{
  id: string
  title: string
  description: string
  venue: string
  address: string
  city: string
  category: Category
  price: string | null
  isFree: boolean
  isFamilyFriendly: boolean
  hours: string | null (e.g., "Mon-Fri 10am-9pm")
  websiteUrl: string
  imageUrl: string | null
  isActive: boolean
}
```

### Categories (Enum)
- MUSIC
- COMEDY
- MOVIES
- THEATER
- FAMILY_KIDS
- FOOD_DRINK
- SPORTS_RECREATION
- COMMUNITY_GOVERNMENT
- ART_GALLERIES
- CLASSES_WORKSHOPS

---

## Data Source Strategy

### Tier 1: Structured Data (Easy)
These have JSON-LD or clean HTML - use Cheerio:
- **visitnyack.org** - The Events Calendar plugin with JSON-LD
- **eventbrite.com** - Schema.org JSON-LD (or use API)
- **levitylive.com** - Schema markup
- **theangelnyack.com** - Clean event listings

### Tier 2: JavaScript-Rendered (Medium)
Need Puppeteer/Playwright:
- **nyacklibrary.org** - LocalHop widget
- **tickets.tarrytownmusichall.org** - External ticketing platform

### Tier 3: Unstructured/Blocked (Hard)
Requires special handling:
- **nyacknewsandviews.com** - Parse "Weekly Rec" blog posts
- **artsrock.org** - Returns 403, may need email subscription or manual entry
- **Facebook pages** - Unreliable scraping, consider manual or skip for MVP

### Tier 4: APIs (If Available)
- **Eventbrite API** - Official API available
- **Ticketmaster API** - Discovery API available

### MVP Sources (Start Here)
1. visitnyack.org
2. eventbrite.com (API)
3. levitylive.com
4. theangelnyack.com
5. Palisades Center movies (check showtimes API)

Expand to Tier 2 and 3 sources after MVP is stable.

---

## Project Structure

```
nyack-today/
├── app/
│   ├── page.tsx                 # Homepage (Tonight view)
│   ├── layout.tsx               # Root layout
│   ├── events/
│   │   └── [id]/page.tsx        # Event detail page
│   ├── activities/
│   │   └── page.tsx             # Always Available section
│   ├── admin/
│   │   ├── page.tsx             # Admin dashboard
│   │   └── layout.tsx           # Admin auth wrapper
│   └── api/
│       ├── events/route.ts      # Events API
│       └── scrape/route.ts      # Manual scrape trigger
├── components/
│   ├── EventCard.tsx
│   ├── EventList.tsx
│   ├── FilterBar.tsx
│   ├── DateTabs.tsx             # Tonight | Tomorrow | Weekend | Week
│   ├── CategoryFilter.tsx
│   ├── Header.tsx
│   └── Footer.tsx
├── lib/
│   ├── db.ts                    # Prisma client
│   ├── scrapers/
│   │   ├── index.ts             # Scraper orchestrator
│   │   ├── visitnyack.ts
│   │   ├── eventbrite.ts
│   │   ├── levitylive.ts
│   │   ├── angelnyack.ts
│   │   └── utils.ts             # Shared parsing utilities
│   └── utils/
│       ├── dates.ts             # Date helpers
│       └── categories.ts        # Category mapping
├── prisma/
│   └── schema.prisma
├── public/
├── styles/
│   └── globals.css
├── .env.local
├── netlify.toml
└── package.json
```

---

## UI/UX Design

### Homepage (Tonight-First)
```
┌────────────────────────────────────────┐
│  NYACK TODAY                       ≡   │
├────────────────────────────────────────┤
│  [Tonight] [Tomorrow] [Weekend] [Week] │
├────────────────────────────────────────┤
│  Filters: [All Categories ▼] [Free ▼]  │
│           [Nyack ▼] [Family-Friendly]  │
├────────────────────────────────────────┤
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ Comedy Night at Levity Live     │  │
│  │ 8:00 PM · West Nyack · $25      │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ Jazz at Maureen's               │  │
│  │ 7:30 PM · Nyack · $15           │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ Movie: [Title]                  │  │
│  │ 7:00 PM · Palisades · $14       │  │
│  └──────────────────────────────────┘  │
│                                        │
├────────────────────────────────────────┤
│  [Events]        [Always Available]    │
└────────────────────────────────────────┘
```

### Key UX Elements
- **Date tabs** prominent at top
- **Quick filters** always visible
- **Family-friendly toggle** easily accessible
- **Event cards** show: title, time, location, price, category icon
- **Bottom nav** to switch between Events and Always Available

---

## Design Tokens (Warm Sunset Palette)

```css
/* Primary - Sunset Orange */
--primary-50: #fff7ed;
--primary-500: #f97316;
--primary-600: #ea580c;

/* Secondary - Golden Hour */
--secondary-500: #eab308;

/* Accent - River Blue (for contrast) */
--accent-500: #0ea5e9;

/* Neutrals */
--gray-50: #fafaf9;
--gray-900: #1c1917;
```

---

## Implementation Phases

### Phase 1: Project Setup & Core Infrastructure
- Initialize Next.js project with Tailwind
- Set up Prisma with PostgreSQL (Supabase)
- Create database schema and migrations
- Basic project structure

### Phase 2: Frontend Shell
- Homepage layout with date tabs
- Event card component
- Filter bar (non-functional initially)
- Mobile-responsive design
- "Always Available" page shell

### Phase 3: First Scrapers (MVP Sources)
- Build scraper for visitnyack.org
- Build scraper for Eventbrite (API or scrape)
- Build scraper for theangelnyack.com
- Scraper orchestration and deduplication logic
- Manual trigger endpoint for testing

### Phase 4: Data Flow & Display
- Connect frontend to database
- Implement filtering logic
- Date-based queries (tonight, tomorrow, weekend, week)
- Category and price filters
- Family-friendly filter

### Phase 5: Admin Dashboard
- Protected admin route
- Event list with hide/unhide functionality
- Manual event entry form
- Scraper status/logs view

### Phase 6: Automation & Polish
- Set up daily cron job (GitHub Actions or Netlify)
- Error handling and notifications
- Loading states and empty states
- SEO metadata
- Favicon and branding

### Phase 7: Additional Scrapers (Post-MVP)
- Levity Live
- Nyack Library (Puppeteer)
- Tarrytown Music Hall
- Movie showtimes

---

## Key Files to Create

| File | Purpose |
|------|---------|
| `app/page.tsx` | Homepage with tonight-first view |
| `app/admin/page.tsx` | Admin dashboard |
| `components/EventCard.tsx` | Reusable event display |
| `components/FilterBar.tsx` | Filter controls |
| `lib/scrapers/index.ts` | Scraper orchestrator |
| `lib/scrapers/visitnyack.ts` | First scraper implementation |
| `prisma/schema.prisma` | Database schema |
| `netlify.toml` | Deployment config |

---

## Verification & Testing

### Manual Testing
1. Run `npm run dev` and verify homepage loads
2. Trigger scraper manually and verify events appear
3. Test all filters (date, category, price, family-friendly)
4. Test on mobile viewport
5. Verify admin can hide events

### Scraper Testing
1. Run individual scrapers in isolation
2. Verify data parsing is correct
3. Check deduplication works
4. Confirm daily cron executes

### Deployment Testing
1. Deploy to Netlify
2. Verify environment variables set
3. Test production scraper execution
4. Verify database connectivity

---

## Data Sources Reference

### Venues
- Levity Live (comedy) - levitylive.com/nyack
- Nyack Center
- ArtsRock - artsrock.org
- Maureen's Jazz Cellar
- Olive's
- Tarrytown Music Hall - tarrytownmusichall.org
- The Angel Nyack - theangelnyack.com
- Piermont Club - piermont.club
- West Gate Lounge (Facebook)

### Calendars & Aggregators
- Visit Nyack - visitnyack.org/calendar/
- Nyack Library - nyacklibrary.org/eventscalendar.html
- Nyack News and Views - nyacknewsandviews.com
- Village of Nyack official site
- Nyack Chamber of Commerce

### Ticketing Platforms
- Eventbrite (Nyack-area search)
- Ticketmaster (Nyack-area search)

### Movies
- Palisades Center theater
