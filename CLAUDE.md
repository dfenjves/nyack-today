# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nyack Today is a mobile-friendly events aggregator for Nyack, NY. It scrapes events from 15+ local sources (venues, calendars, ticketing platforms), displays them with a "tonight-first" UX, and includes filtering by date, category, price, and family-friendliness.

## Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build
npm run lint     # Run ESLint
npx prisma migrate dev    # Run database migrations
npx prisma generate       # Regenerate Prisma client after schema changes
npx prisma studio         # Open database GUI
```

## Planning
Ensure you are looking at plan.md for the most up to date plan. For any changes to the plan, ensure that plan.md gets updated accordingly.

`plan.md` is the strategic roadmap (phases, metrics, cadence) for making Nyack Today the go-to source for what's going on in Nyack. The original technical implementation plan is archived at `docs/archive/initial-implementation-plan.md`.

## Architecture

```
Data Sources → Scrapers (lib/scrapers/) → Database (Prisma/SQLite) → Next.js API → React Frontend
```

**Key architectural decisions:**
- **Database**: Supabase PostgreSQL for both local dev and production
- **Prisma client**: Standard output to `node_modules/@prisma/client`
- **Imports**: Use `@prisma/client` for PrismaClient, types, and Category enum
- **Admin auth**: Simple password protection via `ADMIN_PASSWORD` env var

## Data Model

Three main models in `prisma/schema.prisma`:
- **Event**: One-time events with startDate, venue, category, price, isFamilyFriendly
- **Activity**: Always-available things (bowling, go-karts) - manually curated
- **ScraperLog**: Tracks scraper runs for debugging

Categories: MUSIC, COMEDY, MOVIES, THEATER, FAMILY_KIDS, FOOD_DRINK, SPORTS_RECREATION, COMMUNITY_GOVERNMENT, ART_GALLERIES, CLASSES_WORKSHOPS, OTHER

## Key Files

- `src/lib/db.ts` - Singleton Prisma client
- `src/lib/utils/dates.ts` - Date filtering (tonight, tomorrow, weekend, week)
- `src/lib/utils/categories.ts` - Category labels, icons, colors, auto-categorization
- `src/lib/scrapers/` - Individual scrapers per data source (to be built)
- `data-sources.md` - Running list of scraping targets with tier classification

## Scrapers

**Start with the generic scraper.** `src/lib/scrapers/generic.ts` is
config-driven: a `Source` row in the database describes a page, the scraper
fetches it, reduces it to readable text, and runs it through the existing AI
extraction. Adding a venue takes minutes at `/admin/sources` — paste a URL, hit
Test, adjust, Save — with no code and no deploy. Write a bespoke scraper only
when the generic one genuinely can't do the job (a private API, an unusual auth
flow, a site that needs multi-step navigation).

Instagram accounts are managed the same way at `/admin/instagram` (the
`InstagramHandle` table, with a per-handle venue hint for the AI). The legacy
`INSTAGRAM_HANDLES` env var is still merged in; the page can import it.

Fetch modes, in order of preference: `ICAL` and `JSONLD` (structured, no AI
call, exact times), `RSS`, `CHEERIO` (static HTML), `PUPPETEER` (renders JS;
includes iframe documents, which is how the Nyack Library's LocalHop widget is
read). New sources default to `autoPublish = false`, so their events become
`EventSubmission` rows for review in `/admin/submissions` instead of going live.
See `data-sources.md` for the onboarded list.

Bespoke scrapers (one file each in `src/lib/scrapers/`) fall into three tiers:

1. **Tier 1** (Cheerio): Sites with JSON-LD or clean HTML - visitnyack.org, eventbrite.com, levitylive.com
2. **Tier 2** (Puppeteer): JS-rendered pages - nyacklibrary.org, tickets.tarrytownmusichall.org
3. **Tier 3** (Special handling): Unstructured/blocked - nyacknewsandviews.com, Facebook pages

## Design System

Warm sunset color palette (orange primary, stone neutrals). See `src/app/globals.css` for CSS variables. Primary color: `#f97316` (orange-500).
