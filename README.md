# Nyack Today

A mobile-friendly events aggregator for Nyack, NY. Automatically scrapes events from 15+ local sources (venues, calendars, ticketing platforms, and email newsletters) and displays them with a "tonight-first" UX.

🌐 **Live Site**: https://nyack-today.vercel.app

---

## Features

- 🎭 **Automated Event Scraping** - Pulls events from local venues, calendars, and newsletters
- 📧 **AI-Powered Email Processing** - Extracts events from newsletters using GPT-4
- 📅 **Smart Filtering** - Filter by date (tonight, tomorrow, weekend, week, month), category, price, family-friendly
- 🎨 **Category Auto-Detection** - Automatically categorizes events (Music, Comedy, Theater, etc.)
- 🔄 **Duplicate Prevention** - Smart deduplication across all sources
- 📱 **Mobile-First Design** - Optimized for phones with sunset color palette
- 🔔 **Notifications** - Discord/Slack alerts for scraper runs
- 🛡️ **Row Level Security** - Supabase RLS policies protect database

---

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **Styling**: Tailwind CSS
- **Deployment**: Vercel
- **AI**: OpenAI GPT-4o (event extraction from emails)
- **Email**: Gmail API (OAuth 2.0)

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database (Supabase recommended)
- Gmail account (for email scraper - optional)
- OpenAI API key (for email scraper - optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/nyack-today.git
cd nyack-today

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

Visit http://localhost:3000

---

## Environment Variables

### Required (Core Functionality)

```bash
# Database (Supabase)
DATABASE_URL="postgresql://..." # Connection pooling (pgbouncer)
DIRECT_URL="postgresql://..."   # Direct connection with service role

# Admin Authentication
ADMIN_PASSWORD="your-secure-password"

# Site Configuration
NEXT_PUBLIC_SITE_URL="https://your-domain.com"
```

### Optional (Email Scraper)

```bash
# Gmail API OAuth
GMAIL_CLIENT_ID="..."
GMAIL_CLIENT_SECRET="..."
GMAIL_REFRESH_TOKEN="..."

# Email Processing
EMAIL_SENDER_ALLOWLIST='["newsletter@example.com"]'
EMAIL_MAX_AGE_DAYS="7"
EMAIL_MAX_PER_RUN="50"

# OpenAI API
OPENAI_API_KEY="sk-..."
AI_PROVIDER="openai"
AI_MODEL="gpt-4o"
```

### Optional (Other)

```bash
# Scraper API Key (for cron jobs)
SCRAPER_API_KEY="your-api-key"

# Notifications
DISCORD_WEBHOOK_URL="..."
SLACK_WEBHOOK_URL="..."
```

---

## Email Newsletter Scraper

The email scraper automatically monitors a Gmail inbox for event newsletters and uses AI to extract event data.

### Features

- 🤖 **AI-Powered Extraction** - GPT-4 extracts events from any newsletter format
- 📬 **Gmail Integration** - Polls Gmail inbox for new newsletters
- 🏷️ **Smart Labeling** - Marks processed emails with Gmail labels
- 💰 **Cost-Effective** - ~$0.40-$2/month for AI processing
- 🔄 **Automatic Deduplication** - Prevents duplicate events across sources

### Setup Guide

See detailed setup instructions in [docs/email-scraper-setup.md](docs/email-scraper-setup.md)

**Quick summary:**
1. Create dedicated Gmail account
2. Set up Google Cloud project and Gmail API
3. Get OpenAI API key
4. Configure environment variables
5. Get Gmail refresh token
6. Subscribe to newsletters

### How It Works

```
Newsletter arrives → Gmail API fetches → GPT-4 extracts events →
Events saved to DB → Email labeled as processed
```

### Manual Trigger

```bash
# Run email scraper only
curl -X POST http://localhost:3000/api/scrape?source=Email%20Newsletters \
  -H "x-admin-password: your-password"

# Run all scrapers (including email)
curl -X POST http://localhost:3000/api/scrape \
  -H "x-admin-password: your-password"
```

---

## Data Sources

### Web Scrapers (7 sources)
- Visit Nyack (JSON-LD)
- The Angel Nyack (JSON-LD)
- Eventbrite (API/HTML)
- Levity Live (HTML)
- Elmwood Playhouse (HTML)
- Rivertown Film (HTML)
- Village of Nyack (HTML)

### Email Newsletters (AI-powered)
- Any venue/organization newsletter
- Automatically extracts events from HTML/text emails

---

## Admin Dashboard

Access at `/admin` with your admin password.

**Features:**
- View all events (upcoming, past, hidden)
- Manually add/edit/delete events
- Hide spam or duplicate events
- View scraper logs and status
- Manage email scraper configuration

---

## Database Schema

### Event Model
```prisma
model Event {
  id              String    @id @default(cuid())
  title           String
  description     String?
  startDate       DateTime  @index
  endDate         DateTime?
  venue           String
  address         String?
  city            String    @default("Nyack")
  isNyackProper   Boolean   @default(true)
  category        Category  @default(OTHER) @index
  price           String?
  isFree          Boolean   @default(false)
  isFamilyFriendly Boolean  @default(false)
  sourceUrl       String
  sourceName      String
  imageUrl        String?
  isHidden        Boolean   @default(false) @index
  sourceHash      String?   @unique
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

### Categories
MUSIC, COMEDY, MOVIES, THEATER, FAMILY_KIDS, FOOD_DRINK, SPORTS_RECREATION, COMMUNITY_GOVERNMENT, ART_GALLERIES, CLASSES_WORKSHOPS, OTHER

---

## Automated Scraping

Events are automatically scraped daily via Vercel Cron Jobs.

**Schedule**: Daily at 6:00 AM UTC (1:00 AM EST / 2:00 AM EDT)

**Configuration**: See `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/scrape",
      "schedule": "0 6 * * *"
    }
  ]
}
```

**Monitor scraper runs:**
```bash
curl https://your-domain.com/api/admin/scrapers \
  -H "x-admin-password: your-password"
```

---

## Development Commands

```bash
# Start dev server
npm run dev

# Run linter
npm run lint

# Build for production
npm run build

# Database commands
npx prisma migrate dev        # Run migrations
npx prisma generate          # Regenerate Prisma client
npx prisma studio            # Open database GUI

# Manual scraper trigger
curl -X POST http://localhost:3000/api/scrape \
  -H "x-admin-password: your-password"
```

---

## Project Structure

```
nyack-today/
├── src/
│   ├── app/                  # Next.js App Router pages
│   │   ├── api/             # API routes
│   │   │   ├── scrape/      # Scraper trigger endpoint
│   │   │   └── admin/       # Admin API endpoints
│   │   ├── admin/           # Admin dashboard pages
│   │   └── page.tsx         # Homepage
│   ├── lib/
│   │   ├── scrapers/        # Web scrapers
│   │   │   ├── email.ts     # Email newsletter scraper
│   │   │   └── index.ts     # Scraper orchestrator
│   │   ├── gmail/           # Gmail API integration
│   │   │   ├── client.ts    # Gmail API client
│   │   │   ├── auth.ts      # OAuth token management
│   │   │   └── processor.ts # Email processing pipeline
│   │   ├── ai/              # AI event extraction
│   │   │   ├── client.ts    # OpenAI/Anthropic client
│   │   │   ├── prompts.ts   # Extraction prompts
│   │   │   └── types.ts     # TypeScript types
│   │   ├── utils/           # Utility functions
│   │   └── db.ts            # Prisma client
│   └── components/          # React components
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── migrations/          # Database migrations
├── docs/
│   └── email-scraper-setup.md  # Email scraper setup guide
└── vercel.json              # Vercel configuration (cron jobs)
```

---

## Security

### Row Level Security (RLS)

The database uses Supabase RLS policies:
- **Public**: Can read events and activities (SELECT only)
- **Write operations**: Blocked via PostgREST (must use Next.js API)
- **ScraperLog**: Completely private (internal use only)

See [RLS_MIGRATION_GUIDE.md](RLS_MIGRATION_GUIDE.md) for details.

### API Authentication

- **Admin Dashboard**: Password-based (`ADMIN_PASSWORD`)
- **Scraper API**: API key (`SCRAPER_API_KEY`) or admin password
- **Gmail API**: OAuth 2.0 with refresh tokens

---

## Monitoring & Notifications

### Discord/Slack Alerts

Configure webhooks to receive notifications:
- Scraper completion summary
- Error alerts
- Event counts (found, added, updated)

```bash
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
```

### Logs

View scraper logs in admin dashboard at `/admin/scrapers`

---

## Cost Estimates

**Email Scraper (AI costs):**
- 40 emails/month: ~$0.40/month
- 200 emails/month: ~$2/month

**Infrastructure:**
- Vercel: Free (Hobby plan)
- Supabase: Free (up to 500 MB database)
- OpenAI API: ~$0.01 per email processed

**Total: ~$0.40-$2/month for full automation**

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT

---

## Support

For setup help, see:
- [Email Scraper Setup Guide](docs/email-scraper-setup.md)
- [RLS Migration Guide](RLS_MIGRATION_GUIDE.md)

For issues, please open a GitHub issue.

---

**Built with ❤️ for the Nyack community**
