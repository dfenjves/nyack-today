-- Manual migration: InstagramHandle table (admin-managed Instagram accounts).
--
-- Apply with the SESSION pooler (port 5432, no pgbouncer=true):
--
--   SESSION_URL=$(echo "$DATABASE_URL" | sed -E 's/:6543/:5432/; s/[?]pgbouncer=true//')
--   npx prisma db execute --file prisma/manual_instagram_handles_migration.sql --url "$SESSION_URL"
--   npx prisma generate
--
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS "InstagramHandle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "handle" TEXT NOT NULL,
    "venueName" TEXT,
    "notes" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "InstagramHandle_handle_key" ON "InstagramHandle"("handle");
CREATE INDEX IF NOT EXISTS "InstagramHandle_enabled_idx" ON "InstagramHandle"("enabled");

-- Seed the venue hints that used to be hard-coded in src/lib/instagram/processor.ts.
INSERT INTO "InstagramHandle" ("id", "handle", "venueName") VALUES
  ('igh_casaofnyack',       'casaofnyack',       'Casa Del Sol'),
  ('igh_hotelnyack',        'hotelnyack',        'Hotel Nyack'),
  ('igh_prohibition_river', 'prohibition.river', 'Prohibition River'),
  ('igh_edwardhopperhouse', 'edwardhopperhouse', 'Edward Hopper House Museum & Study Center'),
  ('igh_nyackboatclub',     'nyackboatclub',     'Nyack Boat Club'),
  ('igh_bigredbooks',       'bigredbooks',       'Big Red Books')
ON CONFLICT ("handle") DO NOTHING;

-- RLS: internal admin configuration, deny-all through Supabase's public API.
-- The app's privileged connection bypasses RLS (see RLS_MIGRATION_GUIDE.md).
ALTER TABLE "InstagramHandle" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instagramhandle_select_policy ON "InstagramHandle";
CREATE POLICY instagramhandle_select_policy ON "InstagramHandle"
  FOR SELECT TO public USING (false);

DROP POLICY IF EXISTS instagramhandle_insert_policy ON "InstagramHandle";
CREATE POLICY instagramhandle_insert_policy ON "InstagramHandle"
  FOR INSERT TO public WITH CHECK (false);

DROP POLICY IF EXISTS instagramhandle_update_policy ON "InstagramHandle";
CREATE POLICY instagramhandle_update_policy ON "InstagramHandle"
  FOR UPDATE TO public USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS instagramhandle_delete_policy ON "InstagramHandle";
CREATE POLICY instagramhandle_delete_policy ON "InstagramHandle"
  FOR DELETE TO public USING (false);
