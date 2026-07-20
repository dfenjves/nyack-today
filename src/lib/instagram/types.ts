/**
 * Instagram Integration Types
 *
 * TypeScript interfaces for the Instagram scraper and post processing.
 * Mirrors the Discord integration (src/lib/discord/types.ts).
 */

/**
 * A single Instagram post, normalized from the Apify actor response
 */
export interface InstagramPostData {
  shortcode: string; // Post shortcode, from the /p/{shortcode}/ URL
  handle: string; // Account username (no @)
  caption: string; // Post caption text
  imageUrls: string[]; // Image URLs (display image + carousel images)
  postedAt: Date; // When the post was published
  url: string; // Canonical post URL
}

/**
 * Status of processing an Instagram post.
 * - success: at least one EventSubmission was created
 * - filtered: the AI found an event but it was dropped (past date, out of area)
 * - no_events: the AI found nothing event-like
 * - error: processing threw (network, AI, DB)
 */
export type ProcessingStatus = 'success' | 'filtered' | 'no_events' | 'error';

/**
 * Result of processing a single Instagram post
 */
export interface ProcessedInstagramPost {
  shortcode: string;
  handle: string;
  status: ProcessingStatus;
  eventsExtracted: number;
  submissionIds: string[]; // IDs of created EventSubmission records
  errorMessage?: string;
}

/**
 * Configuration for the Instagram scraper
 */
export interface InstagramConfig {
  handles: string[]; // Account usernames to monitor (no @)
  apifyToken: string;
  scraperEnabled: boolean;
  intervalHours: number; // Only process posts newer than this many hours
  postsPerHandle: number; // Max posts to pull per handle per run
  aiProvider?: string; // Optional override for AI provider
  aiModel?: string; // Optional override for AI model
}
