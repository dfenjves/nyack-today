/**
 * Apply Discord integration database migration manually
 *
 * Run with: npx tsx scripts/apply-discord-migration.ts
 */

// Load environment variables
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { prisma } from '../src/lib/db';

async function applyMigration() {
  console.log('Applying Discord integration migration...');

  try {
    // Add sourceName column to EventSubmission (if it doesn't exist)
    console.log('Adding sourceName column to EventSubmission...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "EventSubmission"
      ADD COLUMN IF NOT EXISTS "sourceName" TEXT;
    `);
    console.log('✓ sourceName column added');

    // Create DiscordMessage table
    console.log('Creating DiscordMessage table...');
    await prisma.$executeRawUnsafe(`
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
    `);
    console.log('✓ DiscordMessage table created');

    // Create indexes
    console.log('Creating indexes...');
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DiscordMessage_channelId_idx"
      ON "DiscordMessage"("channelId");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DiscordMessage_processedAt_idx"
      ON "DiscordMessage"("processedAt");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DiscordMessage_status_idx"
      ON "DiscordMessage"("status");
    `);
    console.log('✓ Indexes created');

    console.log('\n✅ Migration complete!');
    console.log('\nNext steps:');
    console.log('1. Run: npx prisma generate');
    console.log('2. Configure Discord bot in .env.local');
    console.log('3. See docs/discord-setup.md for setup instructions');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();
