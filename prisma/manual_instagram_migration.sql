-- Manual migration for Instagram integration
-- Run this with: psql $DIRECT_URL -f prisma/manual_instagram_migration.sql
-- (or apply the schema with: npx prisma db push)

-- Create InstagramPost table
CREATE TABLE IF NOT EXISTS "InstagramPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shortcode" TEXT NOT NULL UNIQUE,
    "handle" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "postedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "eventsExtracted" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT
);

-- Create indexes on InstagramPost
CREATE INDEX IF NOT EXISTS "InstagramPost_handle_idx" ON "InstagramPost"("handle");
CREATE INDEX IF NOT EXISTS "InstagramPost_processedAt_idx" ON "InstagramPost"("processedAt");
CREATE INDEX IF NOT EXISTS "InstagramPost_status_idx" ON "InstagramPost"("status");

-- Verify the changes
SELECT 'Migration complete!' as status;
