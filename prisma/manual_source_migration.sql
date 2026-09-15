-- Manual migration for the config-driven generic source scraper (Source model).
--
-- This repo does not use `prisma migrate dev` or `prisma db push` (both hang
-- against Supabase's pooler). Apply with the SESSION pooler (port 5432, no
-- pgbouncer=true):
--
--   SESSION_URL=$(echo "$DATABASE_URL" | sed -E 's/:6543/:5432/; s/[?]pgbouncer=true//')
--   npx prisma db execute --file prisma/manual_source_migration.sql --url "$SESSION_URL"
--   npx prisma generate
--
-- Idempotent: safe to re-run.

-- Enum: how the generic scraper fetches a source's pages
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SourceFetchMode') THEN
    CREATE TYPE "SourceFetchMode" AS ENUM ('CHEERIO', 'PUPPETEER', 'ICAL', 'RSS', 'JSONLD');
  END IF;
END
$$;

-- Source table
CREATE TABLE IF NOT EXISTS "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "fetchMode" "SourceFetchMode" NOT NULL DEFAULT 'CHEERIO',
    "defaultVenue" TEXT,
    "defaultAddress" TEXT,
    "defaultCity" TEXT NOT NULL DEFAULT 'Nyack',
    "isNyackProper" BOOLEAN NOT NULL DEFAULT true,
    "defaultCategory" "Category",
    "familyFriendlyHint" BOOLEAN,
    "autoPublish" BOOLEAN NOT NULL DEFAULT false,
    "cleanRuns" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraints and indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Source_name_key" ON "Source"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Source_slug_key" ON "Source"("slug");
CREATE INDEX IF NOT EXISTS "Source_enabled_idx" ON "Source"("enabled");

-- RLS: internal admin configuration, never exposed through Supabase's public
-- API. Same deny-all pattern as ScraperLog / DiscordMessage / InstagramPost
-- (see RLS_MIGRATION_GUIDE.md). The app's own privileged connection bypasses RLS.
ALTER TABLE "Source" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS source_select_policy ON "Source";
CREATE POLICY source_select_policy ON "Source"
  FOR SELECT TO public USING (false);

DROP POLICY IF EXISTS source_insert_policy ON "Source";
CREATE POLICY source_insert_policy ON "Source"
  FOR INSERT TO public WITH CHECK (false);

DROP POLICY IF EXISTS source_update_policy ON "Source";
CREATE POLICY source_update_policy ON "Source"
  FOR UPDATE TO public USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS source_delete_policy ON "Source";
CREATE POLICY source_delete_policy ON "Source"
  FOR DELETE TO public USING (false);
