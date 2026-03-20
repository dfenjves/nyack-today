/**
 * Discord Event Scraper
 *
 * Monitors Discord channels for event posts and extracts events using AI
 */

import { Scraper, ScraperResult } from './types';

/**
 * Discord scraper
 *
 * Fetches messages from monitored Discord channels, uses AI to extract event data,
 * and creates EventSubmission records for admin review.
 *
 * Environment variables required:
 * - DISCORD_BOT_TOKEN
 * - DISCORD_GUILD_ID
 * - DISCORD_MONITORED_CHANNELS (JSON array of channel IDs)
 * - OPENAI_API_KEY or ANTHROPIC_API_KEY
 *
 * Optional configuration:
 * - DISCORD_SCRAPER_ENABLED (default: false)
 * - DISCORD_SCRAPER_INTERVAL_HOURS (default: 6)
 * - DISCORD_AI_PROVIDER (default: AI_PROVIDER)
 * - DISCORD_AI_MODEL (default: AI_MODEL)
 */
export const discordScraper: Scraper = {
  name: 'Discord',

  async scrape(): Promise<ScraperResult> {
    try {
      console.log('Starting Discord scraper...');

      // Dynamically import Discord modules to avoid bundling issues
      const { getDiscordConfig, disconnectDiscordClient } = await import('../discord/client');
      const { processDiscordMessages } = await import('../discord/processor');

      // Check if enabled
      const config = getDiscordConfig();
      if (!config.scraperEnabled) {
        return {
          sourceName: 'Discord',
          events: [],
          status: 'error',
          errorMessage:
            'Discord scraper disabled. Set DISCORD_SCRAPER_ENABLED=true to enable.',
        };
      }

      // Check required environment variables
      if (!config.botToken) {
        return {
          sourceName: 'Discord',
          events: [],
          status: 'error',
          errorMessage:
            'DISCORD_BOT_TOKEN not configured. Please add bot token to environment variables.',
        };
      }

      if (!config.guildId) {
        return {
          sourceName: 'Discord',
          events: [],
          status: 'error',
          errorMessage:
            'DISCORD_GUILD_ID not configured. Please add Discord server ID to environment variables.',
        };
      }

      if (config.monitoredChannels.length === 0) {
        return {
          sourceName: 'Discord',
          events: [],
          status: 'error',
          errorMessage:
            'DISCORD_MONITORED_CHANNELS is empty. Please add channel IDs to environment variables.',
        };
      }

      if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
        return {
          sourceName: 'Discord',
          events: [],
          status: 'error',
          errorMessage:
            'OPENAI_API_KEY or ANTHROPIC_API_KEY not configured. Please add AI API key to environment variables.',
        };
      }

      // Process Discord messages
      const result = await processDiscordMessages();

      // Disconnect Discord client to free up resources
      await disconnectDiscordClient();

      // Determine status
      let status: 'success' | 'error' | 'partial' = 'success';
      let errorMessage: string | undefined;

      if (result.errorCount > 0 && result.successCount === 0) {
        status = 'error';
        errorMessage = `Failed to process all ${result.errorCount} messages`;
      } else if (result.errorCount > 0) {
        status = 'partial';
        errorMessage = `Successfully processed ${result.successCount} messages, but ${result.errorCount} failed`;
      }

      console.log('Discord scraper complete:', {
        totalMessages: result.processedMessages.length,
        totalSubmissions: result.totalSubmissions,
        status,
      });

      // Return empty events array (Discord creates EventSubmissions, not Events)
      return {
        sourceName: 'Discord',
        events: [],
        status,
        errorMessage,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      console.error('Discord scraper failed:', errorMessage);

      // Ensure Discord client is disconnected on error
      try {
        const { disconnectDiscordClient } = await import('../discord/client');
        await disconnectDiscordClient();
      } catch (disconnectError) {
        console.error('Error disconnecting Discord client:', disconnectError);
      }

      return {
        sourceName: 'Discord',
        events: [],
        status: 'error',
        errorMessage: `Discord scraper failed: ${errorMessage}`,
      };
    }
  },
};
