/**
 * Discord Integration Types
 *
 * TypeScript interfaces for Discord bot and message processing
 */

/**
 * Discord message data fetched from Discord API
 */
export interface DiscordMessageData {
  messageId: string; // Discord snowflake ID
  channelId: string;
  channelName: string;
  authorId: string;
  authorName: string;
  content: string;
  attachmentUrls: string[]; // Image URLs from message attachments
  postedAt: Date;
}

/**
 * Status of processing a Discord message
 */
export type ProcessingStatus = 'success' | 'error' | 'no_events';

/**
 * Result of processing a single Discord message
 */
export interface ProcessedDiscordMessage {
  messageId: string;
  channelName: string;
  authorName: string;
  status: ProcessingStatus;
  eventsExtracted: number;
  submissionIds: string[]; // IDs of created EventSubmission records
  errorMessage?: string;
}

/**
 * Configuration for Discord scraper
 */
export interface DiscordConfig {
  botToken: string;
  guildId: string;
  monitoredChannels: string[]; // Array of channel IDs to monitor
  scraperEnabled: boolean;
  intervalHours: number;
  aiProvider?: string; // Optional override for AI provider
  aiModel?: string; // Optional override for AI model
}
