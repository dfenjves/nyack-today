# Deployment Guide

This guide walks you through deploying Nyack Today to Vercel with Supabase.

## Prerequisites

- GitHub account with this repo
- Vercel account (free tier works)
- Supabase account (free tier works)

---

## Step 1: Set Up Supabase Database

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be provisioned (~2 minutes)
3. Go to **Settings > Database**
4. Copy the connection strings:
   - **Connection string (Transaction pooler)** → `DATABASE_URL`
   - **Connection string (Session pooler)** → `DIRECT_URL`

   > Note: Replace `[YOUR-PASSWORD]` with your database password

---

## Step 2: Deploy to Vercel

### Option A: One-Click Deploy (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/nyack-today)

### Option B: Manual Setup

1. Go to [vercel.com](https://vercel.com) and click "Add New Project"
2. Import your GitHub repository
3. Configure the project:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)

---

## Step 3: Configure Environment Variables

In Vercel, go to **Settings > Environment Variables** and add:

| Variable | Value | Required |
|----------|-------|----------|
| `DATABASE_URL` | Supabase transaction pooler URL | Yes |
| `DIRECT_URL` | Supabase session pooler URL | Yes |
| `ADMIN_PASSWORD` | Strong password for /admin | Yes |
| `SCRAPER_API_KEY` | Random string for cron auth | Yes |
| `NEXT_PUBLIC_SITE_URL` | Your Vercel URL (e.g., `https://nyack-today.vercel.app`) | Yes |
| `DISCORD_WEBHOOK_URL` | Discord webhook for notifications | No |
| `SLACK_WEBHOOK_URL` | Slack webhook for notifications | No |

### Generating a Secure API Key

```bash
openssl rand -hex 32
```

---

## Step 4: Run Database Migration

After deployment, you need to create the database tables.

### Option A: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Link to your project
vercel link

# Pull environment variables
vercel env pull .env.local

# Run migration
npx prisma migrate deploy
```

### Option B: Via Supabase SQL Editor

1. Go to your Supabase project > SQL Editor
2. Copy and paste the SQL from `prisma/migrations/*/migration.sql`
3. Run the SQL

---

## Step 5: Set Up Automated Scraping

### GitHub Actions (Recommended)

1. Go to your GitHub repo > **Settings > Secrets and variables > Actions**
2. Add these secrets:
   - `SITE_URL`: Your Vercel deployment URL
   - `SCRAPER_API_KEY`: Same value as in Vercel

The scraper will run daily at 6 AM ET automatically.

### Manual Trigger

You can also trigger scrapers manually:
- GitHub: Actions > Daily Event Scraper > Run workflow
- Admin: Go to /admin and click "Run Scrapers"

---

## Step 6: Verify Deployment

1. Visit your Vercel URL
2. Go to `/admin` and log in with your `ADMIN_PASSWORD`
3. Click "Run Scrapers" to populate initial data
4. Check the homepage for events

---

## Environment Variables Reference

```bash
# Required
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
ADMIN_PASSWORD=your-secure-password
SCRAPER_API_KEY=random-32-char-string
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app

# Optional - Notifications
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

---

## Custom Domain (Optional)

1. In Vercel, go to **Settings > Domains**
2. Add your custom domain
3. Update DNS records as instructed
4. Update `NEXT_PUBLIC_SITE_URL` to your custom domain
5. Update `robots.txt` sitemap URL

---

## Troubleshooting

### "Cannot find module '@prisma/client'"
Run `npx prisma generate` locally and redeploy.

### Database connection errors
- Verify `DATABASE_URL` and `DIRECT_URL` are correct
- Check Supabase project is not paused (free tier pauses after inactivity)
- Ensure you're using the pooler URLs (port 6543 for transaction, 5432 for session)

### Scraper not running
- Check GitHub Actions logs for errors
- Verify `SITE_URL` and `SCRAPER_API_KEY` secrets are set
- Test manually: `curl -X POST "https://your-site.vercel.app/api/scrape" -H "x-scraper-key: YOUR_KEY"`

### OG images not showing
- Clear social media cache (use Twitter Card Validator, Facebook Debugger)
- Verify the edge runtime is working: visit `https://your-site.vercel.app/opengraph-image`
