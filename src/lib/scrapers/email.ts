/**
 * Email Newsletter Scraper
 *
 * Monitors a Gmail account for event newsletters and extracts events using AI
 */

import { Scraper, ScraperResult } from './types';
import { processEmails } from '../gmail/processor';

/**
 * Email newsletter scraper
 *
 * Fetches unread emails from allowlisted senders, uses AI to extract event data,
 * and returns events in the standard ScrapedEvent format.
 *
 * Environment variables required:
 * - GMAIL_CLIENT_ID
 * - GMAIL_CLIENT_SECRET
 * - GMAIL_REFRESH_TOKEN
 * - EMAIL_SENDER_ALLOWLIST (JSON array of allowed sender emails)
 * - OPENAI_API_KEY or ANTHROPIC_API_KEY
 *
 * Optional configuration:
 * - EMAIL_MAX_AGE_DAYS (default: 7)
 * - EMAIL_MAX_PER_RUN (default: 50)
 * - AI_PROVIDER (default: "openai")
 * - AI_MODEL (default: "gpt-4o")
 * - AI_MAX_TOKENS (default: 4096)
 * - AI_TEMPERATURE (default: 0.1)
 */
export const emailScraper: Scraper = {
  name: 'Email Newsletters',

  async scrape(): Promise<ScraperResult> {
    try {
      console.log('Starting email newsletter scraper...');

      // Check if required environment variables are set
      if (!process.env.GMAIL_REFRESH_TOKEN) {
        return {
          sourceName: 'Email Newsletters',
          events: [],
          status: 'error',
          errorMessage:
            'GMAIL_REFRESH_TOKEN not configured. Please complete OAuth setup via /admin/gmail-setup',
        };
      }

      if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
        return {
          sourceName: 'Email Newsletters',
          events: [],
          status: 'error',
          errorMessage:
            'OPENAI_API_KEY or ANTHROPIC_API_KEY not configured. Please add AI API key to environment variables.',
        };
      }

      const allowedSenders = JSON.parse(
        process.env.EMAIL_SENDER_ALLOWLIST || '[]'
      );
      if (allowedSenders.length === 0) {
        return {
          sourceName: 'Email Newsletters',
          events: [],
          status: 'error',
          errorMessage:
            'EMAIL_SENDER_ALLOWLIST is empty. Please add allowed sender emails to environment variables.',
        };
      }

      // Process emails
      const result = await processEmails();

      // Collect all events from processed emails
      const allEvents = result.processedEmails.flatMap(
        (email) => email.events
      );

      // Determine status
      let status: 'success' | 'error' | 'partial' = 'success';
      let errorMessage: string | undefined;

      if (result.errorCount > 0 && result.successCount === 0) {
        status = 'error';
        errorMessage = `Failed to process all ${result.errorCount} emails`;
      } else if (result.errorCount > 0) {
        status = 'partial';
        errorMessage = `Successfully processed ${result.successCount} emails, but ${result.errorCount} failed`;
      }

      console.log('Email scraper complete:', {
        totalEmails: result.processedEmails.length,
        totalEvents: allEvents.length,
        status,
      });

      return {
        sourceName: 'Email Newsletters',
        events: allEvents,
        status,
        errorMessage,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      console.error('Email scraper failed:', errorMessage);

      return {
        sourceName: 'Email Newsletters',
        events: [],
        status: 'error',
        errorMessage: `Email scraper failed: ${errorMessage}`,
      };
    }
  },
};
