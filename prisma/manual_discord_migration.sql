-- Manual migration for Discord integration
-- Run this with: psql $DATABASE_URL -f prisma/manual_discord_migration.sql

-- Add sourceName column to EventSubmission if it doesn't exist
ALTER TABLE "EventSubmission" ADD COLUMN IF NOT EXISTS "sourceName" TEXT;

-- Create DiscordMessage table
CREATE TABLE IF NOT EXISTS "DiscordMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL UNIQUE,
    "channelId" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachmentUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "postedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "eventsExtracted" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT
);

-- Create indexes on DiscordMessage
CREATE INDEX IF NOT EXISTS "DiscordMessage_channelId_idx" ON "DiscordMessage"("channelId");
CREATE INDEX IF NOT EXISTS "DiscordMessage_processedAt_idx" ON "DiscordMessage"("processedAt");
CREATE INDEX IF NOT EXISTS "DiscordMessage_status_idx" ON "DiscordMessage"("status");

-- Verify the changes
SELECT 'Migration complete!' as status;
