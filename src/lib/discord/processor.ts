/**
 * Discord Message Processing Pipeline
 *
 * Orchestrates the flow: Discord → AI extraction → EventSubmission creation
 */

import { prisma } from '@/lib/db';
import { extractEventsFromDiscord } from '../ai/client';
import { ExtractedEvent } from '../ai/types';
import { fetchMessagesSince, getDiscordConfig } from './client';
import { ProcessedDiscordMessage, DiscordMessageData } from './types';
import {
  isNyackProper,
  isInCoverageArea,
  parsePrice,
  guessFamilyFriendly,
} from '../scrapers/utils';
import { guessCategory } from '../utils/categories';

/**
 * Converts AI-extracted event to EventSubmission record
 *
 * Similar to email processor but creates EventSubmission instead of ScrapedEvent
 */
async function createEventSubmission(
  extracted: ExtractedEvent,
  messageMetadata: {
    messageId: string;
    channelName: string;
    authorName: string;
  }
): Promise<string | null> {
  try {
    // Parse dates
    const startDate = new Date(extracted.startDate);
    if (isNaN(startDate.getTime())) {
      console.warn(`Invalid start date for event: ${extracted.title}`);
      return null;
    }

    // Skip past events
    if (startDate < new Date()) {
      return null;
    }

    let endDate: Date | null = null;
    if (extracted.endDate) {
      endDate = new Date(extracted.endDate);
      if (isNaN(endDate.getTime())) {
        endDate = null;
      }
    }

    // Validate required fields
    if (!extracted.title || !extracted.venue || !extracted.city) {
      console.warn('Event missing required fields:', extracted);
      return null;
    }

    // Skip if not in coverage area
    if (!isInCoverageArea(extracted.city)) {
      return null;
    }

    // Parse price
    const { price, isFree } = parsePrice(extracted.price);

    // Determine category and family-friendliness
    const category = guessCategory(extracted.title, extracted.description);
    const isFamilyFriendly = guessFamilyFriendly(
      extracted.title,
      extracted.description
    );

    // Use extracted event URL if available, otherwise link to Discord message
    const sourceUrl = extracted.eventUrl || `discord:${messageMetadata.messageId}`;

    // Create EventSubmission record
    const submission = await prisma.eventSubmission.create({
      data: {
        title: extracted.title,
        description: extracted.description ?? null,
        startDate,
        endDate,
        venue: extracted.venue,
        address: extracted.address ?? null,
        city: extracted.city,
        category,
        price,
        isFree,
        isFamilyFriendly,
        sourceName: 'Discord',
        sourceUrl,
        imageUrl: extracted.imageUrl ?? null,
        submitterEmail: `discord-${messageMetadata.authorName}@nyack.today`,
        status: 'PENDING',
      },
    });

    return submission.id;
  } catch (error) {
    console.error('Error creating event submission:', error);
    return null;
  }
}

/**
 * Processes a single Discord message
 *
 * @param message - Discord message data
 * @returns Processing result
 */
async function processDiscordMessage(
  message: DiscordMessageData
): Promise<ProcessedDiscordMessage> {
  try {
    // Check if message already processed
    const existing = await prisma.discordMessage.findUnique({
      where: { messageId: message.messageId },
    });

    if (existing) {
      console.log(`  ⤳ Message ${message.messageId} already processed, skipping`);
      return {
        messageId: message.messageId,
        channelName: message.channelName,
        authorName: message.authorName,
        status: 'no_events',
        eventsExtracted: 0,
        submissionIds: [],
      };
    }

    console.log(
      `  Processing message from @${message.authorName} in #${message.channelName}`
    );

    // Extract events using AI
    const aiResponse = await extractEventsFromDiscord({
      content: message.content,
      authorName: message.authorName,
      postedAt: message.postedAt.toISOString(),
      channelName: message.channelName,
      attachmentUrls: message.attachmentUrls,
    });

    // Create EventSubmission records for extracted events
    const submissionIds: string[] = [];
    for (const extracted of aiResponse.events) {
      const submissionId = await createEventSubmission(extracted, {
        messageId: message.messageId,
        channelName: message.channelName,
        authorName: message.authorName,
      });

      if (submissionId) {
        submissionIds.push(submissionId);
      }
    }

    // Determine status
    const status =
      submissionIds.length > 0
        ? 'success'
        : aiResponse.events.length > 0
          ? 'error' // Events extracted but none created (filtered out)
          : 'no_events';

    // Save DiscordMessage record
    await prisma.discordMessage.create({
      data: {
        messageId: message.messageId,
        channelId: message.channelId,
        channelName: message.channelName,
        authorId: message.authorId,
        authorName: message.authorName,
        content: message.content,
        attachmentUrls: message.attachmentUrls,
        postedAt: message.postedAt,
        status,
        eventsExtracted: submissionIds.length,
        errorMessage: null,
      },
    });

    console.log(
      `    ✓ Extracted ${submissionIds.length} events (${aiResponse.events.length} total, ${aiResponse.events.length - submissionIds.length} filtered out)`
    );

    return {
      messageId: message.messageId,
      channelName: message.channelName,
      authorName: message.authorName,
      status,
      eventsExtracted: submissionIds.length,
      submissionIds,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    console.error(
      `    ✗ Error processing message ${message.messageId}:`,
      errorMessage
    );

    // Save DiscordMessage with error status
    await prisma.discordMessage.create({
      data: {
        messageId: message.messageId,
        channelId: message.channelId,
        channelName: message.channelName,
        authorId: message.authorId,
        authorName: message.authorName,
        content: message.content,
        attachmentUrls: message.attachmentUrls,
        postedAt: message.postedAt,
        status: 'error',
        eventsExtracted: 0,
        errorMessage,
      },
    });

    return {
      messageId: message.messageId,
      channelName: message.channelName,
      authorName: message.authorName,
      status: 'error',
      eventsExtracted: 0,
      submissionIds: [],
      errorMessage,
    };
  }
}

/**
 * Processes Discord messages and creates EventSubmission records
 *
 * Main entry point for Discord message processing pipeline
 *
 * @returns Summary of processing results
 */
export async function processDiscordMessages(): Promise<{
  processedMessages: ProcessedDiscordMessage[];
  totalSubmissions: number;
  successCount: number;
  errorCount: number;
}> {
  const config = getDiscordConfig();

  console.log('Discord processor configuration:', {
    monitoredChannels: config.monitoredChannels,
    intervalHours: config.intervalHours,
  });

  // Validate configuration
  if (config.monitoredChannels.length === 0) {
    console.warn(
      'DISCORD_MONITORED_CHANNELS is empty. No messages will be processed.'
    );
    return {
      processedMessages: [],
      totalSubmissions: 0,
      successCount: 0,
      errorCount: 0,
    };
  }

  // Get last successful scraper run timestamp
  const lastRun = await prisma.scraperLog.findFirst({
    where: {
      sourceName: 'Discord',
      status: { in: ['success', 'partial'] },
    },
    orderBy: { runAt: 'desc' },
  });

  // Default to checking last 6 hours if no previous run
  const since = lastRun?.runAt || new Date(Date.now() - config.intervalHours * 60 * 60 * 1000);

  console.log(`Fetching Discord messages since ${since.toISOString()}`);

  // Fetch messages from monitored channels
  const messages = await fetchMessagesSince(config.monitoredChannels, since);

  console.log(`Found ${messages.length} new Discord messages`);

  if (messages.length === 0) {
    return {
      processedMessages: [],
      totalSubmissions: 0,
      successCount: 0,
      errorCount: 0,
    };
  }

  // Process each message
  const processedMessages: ProcessedDiscordMessage[] = [];
  let successCount = 0;
  let errorCount = 0;

  for (const message of messages) {
    const result = await processDiscordMessage(message);
    processedMessages.push(result);

    if (result.status === 'success') {
      successCount++;
    } else if (result.status === 'error') {
      errorCount++;
    }
  }

  // Count total submissions created
  const totalSubmissions = processedMessages.reduce(
    (sum, msg) => sum + msg.eventsExtracted,
    0
  );

  console.log(`Discord processing complete:`, {
    totalMessages: messages.length,
    successCount,
    errorCount,
    totalSubmissions,
  });

  return {
    processedMessages,
    totalSubmissions,
    successCount,
    errorCount,
  };
}
