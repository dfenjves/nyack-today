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

## Architecture

```
Data Sources → Scrapers (lib/scrapers/) → Database (Prisma/SQLite) → Next.js API → React Frontend
```

**Key architectural decisions:**
- **Database**: SQLite for local dev, Supabase PostgreSQL for production
- **Prisma client output**: Generated to `src/generated/prisma/` (not node_modules)
- **Imports**: Use `@/generated/prisma/client` for PrismaClient/types, `@/generated/prisma/enums` for Category enum
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

## Scraper Tiers

1. **Tier 1** (Cheerio): Sites with JSON-LD or clean HTML - visitnyack.org, eventbrite.com, levitylive.com
2. **Tier 2** (Puppeteer): JS-rendered pages - nyacklibrary.org, tickets.tarrytownmusichall.org
3. **Tier 3** (Special handling): Unstructured/blocked - nyacknewsandviews.com, Facebook pages

## Design System

Warm sunset color palette (orange primary, stone neutrals). See `src/app/globals.css` for CSS variables. Primary color: `#f97316` (orange-500).
