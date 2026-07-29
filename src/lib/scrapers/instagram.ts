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
 * - INSTAGRAM_HANDLES (comma-separated handles, no @)
 * - APIFY_API_TOKEN
 * - OPENAI_API_KEY or ANTHROPIC_API_KEY
 *
 * Optional:
 * - INSTAGRAM_SCRAPER_INTERVAL_HOURS (default: 24)
 * - INSTAGRAM_POSTS_PER_HANDLE (default: 10)
 * - INSTAGRAM_AI_PROVIDER / INSTAGRAM_AI_MODEL (default: AI_PROVIDER / AI_MODEL)
 */

import { Scraper, ScraperResult } from './types';

export const instagramScraper: Scraper = {
  name: 'Instagram',

  async scrape(): Promise<ScraperResult> {
    try {
      console.log('Starting Instagram scraper...');

      // Dynamically import to keep the module graph light for the common path
      const { getInstagramConfig } = await import('../instagram/client');
      const { processInstagramPosts } = await import('../instagram/processor');

      const config = getInstagramConfig();

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

      if (config.handles.length === 0) {
        return {
          sourceName: 'Instagram',
          events: [],
          status: 'error',
          errorMessage:
            'INSTAGRAM_HANDLES is empty. Please add handles to environment variables.',
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
