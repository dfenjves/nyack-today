/**
 * Instagram Event Scraper
 *
 * Monitors a configured list of Instagram handles for event posts and extracts
 * events using AI. Like the Discord scraper, it creates EventSubmission records
 * (for admin review) rather than live Events, so it returns an empty events
 * array to the orchestrator.
 *
 * Environment variables:
 * - INSTAGRAM_SCRAPER_ENABLED (default: false)
 * - Handles: managed at /admin/instagram (InstagramHandle table); the legacy
 *   INSTAGRAM_HANDLES env var (comma-separated, no @) is still merged in
 * - APIFY_API_TOKEN
 * - OPENAI_API_KEY or ANTHROPIC_API_KEY
 *
 * Optional:
 * - INSTAGRAM_SCRAPER_INTERVAL_DAYS (default: 5) — call Apify at most once per
 *   this many days, and only pull posts from the last this-many days
 * - INSTAGRAM_POSTS_PER_HANDLE (default: 10)
 * - INSTAGRAM_AI_PROVIDER / INSTAGRAM_AI_MODEL (default: AI_PROVIDER / AI_MODEL)
 *
 * Cadence: the scrape job runs daily, but Apify charges per result, so this
 * scraper checks ScraperLog and skips the Apify call unless the last real run
 * was at least INSTAGRAM_SCRAPER_INTERVAL_DAYS ago (with a 12-hour grace so a
 * daily cron lands on day N rather than day N+1). Skipped runs are logged with
 * SKIP_PREFIX so they don't count as real runs.
 */

import { prisma } from '@/lib/db';
import { Scraper, ScraperResult } from './types';

const SOURCE_NAME = 'Instagram';
const SKIP_PREFIX = 'Skipped Apify fetch';
const GRACE_MS = 12 * 60 * 60 * 1000;

/**
 * Returns the time of the most recent run that actually called Apify
 * (success/partial, not a skip), or null if there is none.
 */
async function getLastApifyRunAt(): Promise<Date | null> {
  const last = await prisma.scraperLog.findFirst({
    where: {
      sourceName: SOURCE_NAME,
      status: { in: ['success', 'partial'] },
      OR: [
        { errorMessage: null },
        { NOT: { errorMessage: { startsWith: SKIP_PREFIX } } },
      ],
    },
    orderBy: { runAt: 'desc' },
    select: { runAt: true },
  });
  return last?.runAt ?? null;
}

export const instagramScraper: Scraper = {
  name: 'Instagram',

  async scrape(): Promise<ScraperResult> {
    try {
      console.log('Starting Instagram scraper...');

      // Dynamically import to keep the module graph light for the common path
      const { getInstagramConfig } = await import('../instagram/client');
      const { processInstagramPosts } = await import('../instagram/processor');
      const { resolveInstagramHandles } = await import('../instagram/handles');

      const config = getInstagramConfig();
      const { handles } = await resolveInstagramHandles();

      if (!config.scraperEnabled) {
        return {
          sourceName: 'Instagram',
          events: [],
          status: 'error',
          errorMessage:
            'Instagram scraper disabled. Set INSTAGRAM_SCRAPER_ENABLED=true to enable.',
        };
      }

      if (!config.apifyToken) {
        return {
          sourceName: 'Instagram',
          events: [],
          status: 'error',
          errorMessage:
            'APIFY_API_TOKEN not configured. Please add your Apify token to environment variables.',
        };
      }

      if (handles.length === 0) {
        return {
          sourceName: 'Instagram',
          events: [],
          status: 'error',
          errorMessage:
            'No Instagram handles configured. Add accounts at /admin/instagram.',
        };
      }

      if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
        return {
          sourceName: 'Instagram',
          events: [],
          status: 'error',
          errorMessage:
            'OPENAI_API_KEY or ANTHROPIC_API_KEY not configured. Please add an AI API key to environment variables.',
        };
      }

      // Rate-limit Apify calls: skip unless the interval has (nearly) elapsed.
      const lastRunAt = await getLastApifyRunAt();
      if (lastRunAt) {
        const intervalMs = config.intervalDays * 24 * 60 * 60 * 1000;
        const elapsedMs = Date.now() - lastRunAt.getTime();
        if (elapsedMs < intervalMs - GRACE_MS) {
          const nextRunAt = new Date(lastRunAt.getTime() + intervalMs);
          const message = `${SKIP_PREFIX}: last run ${lastRunAt.toISOString()}, interval ${config.intervalDays}d, next eligible ${nextRunAt.toISOString()}`;
          console.log(`Instagram scraper: ${message}`);
          return {
            sourceName: 'Instagram',
            events: [],
            status: 'success',
            errorMessage: message,
          };
        }
      }

      const result = await processInstagramPosts();

      let status: 'success' | 'error' | 'partial' = 'success';
      let errorMessage: string | undefined;

      if (result.errorCount > 0 && result.successCount === 0) {
        status = 'error';
        errorMessage = `Failed to process all ${result.errorCount} posts`;
      } else if (result.errorCount > 0) {
        status = 'partial';
        errorMessage = `Successfully processed ${result.successCount} posts, but ${result.errorCount} failed`;
      }

      console.log('Instagram scraper complete:', {
        totalPosts: result.processedPosts.length,
        totalSubmissions: result.totalSubmissions,
        status,
      });

      // Return empty events array (Instagram creates EventSubmissions, not Events)
      return {
        sourceName: 'Instagram',
        events: [],
        status,
        errorMessage,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      console.error('Instagram scraper failed:', errorMessage);

      return {
        sourceName: 'Instagram',
        events: [],
        status: 'error',
        errorMessage: `Instagram scraper failed: ${errorMessage}`,
      };
    }
  },
};
