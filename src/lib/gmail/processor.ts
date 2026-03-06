/**
 * Email Processing Pipeline
 *
 * Orchestrates the flow from Gmail → AI extraction → ScrapedEvent conversion
 */

import { ScrapedEvent } from '../scrapers/types';
import { extractEventsFromEmail } from '../ai/client';
import { ExtractedEvent } from '../ai/types';
import {
  listMessages,
  getMessage,
  buildQuery,
  getOrCreateLabel,
  addLabels,
} from './client';
import {
  isNyackProper,
  isInCoverageArea,
  parsePrice,
  guessFamilyFriendly,
} from '../scrapers/utils';
import { guessCategory } from '../utils/categories';

/**
 * Configuration for email processing
 */
export interface EmailProcessorConfig {
  allowedSenders: string[];
  maxAgeDays: number;
  maxEmailsPerRun: number;
}

/**
 * Result of processing a single email
 */
export interface ProcessedEmail {
  messageId: string;
  subject: string;
  from: string;
  events: ScrapedEvent[];
  status: 'success' | 'error';
  errorMessage?: string;
}

/**
 * Gets email processor configuration from environment
 */
function getConfig(): EmailProcessorConfig {
  const allowedSenders = JSON.parse(
    process.env.EMAIL_SENDER_ALLOWLIST || '[]'
  ) as string[];
  const maxAgeDays = parseInt(process.env.EMAIL_MAX_AGE_DAYS || '7', 10);
  const maxEmailsPerRun = parseInt(process.env.EMAIL_MAX_PER_RUN || '50', 10);

  return {
    allowedSenders,
    maxAgeDays,
    maxEmailsPerRun,
  };
}

/**
 * Converts AI-extracted event to ScrapedEvent format
 */
function extractedEventToScrapedEvent(
  extracted: ExtractedEvent,
  emailMetadata: {
    messageId: string;
    subject: string;
    from: string;
  }
): ScrapedEvent | null {
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

    return {
      title: extracted.title,
      description: extracted.description,
      startDate,
      endDate,
      venue: extracted.venue,
      address: extracted.address,
      city: extracted.city,
      isNyackProper: isNyackProper(extracted.city),
      category,
      price,
      isFree,
      isFamilyFriendly,
      sourceUrl: `gmail:${emailMetadata.messageId}`,
      sourceName: 'Email Newsletters',
      imageUrl: extracted.imageUrl,
    };
  } catch (error) {
    console.error('Error converting extracted event to ScrapedEvent:', error);
    return null;
  }
}

/**
 * Processes a single email message
 *
 * @param messageId - Gmail message ID
 * @returns Processed email result with extracted events
 */
async function processEmail(messageId: string): Promise<ProcessedEmail> {
  try {
    // Get full message content
    const message = await getMessage(messageId);

    const subject = message.headers.subject || 'No subject';
    const from = message.headers.from || 'Unknown sender';
    const date = message.headers.date || new Date().toISOString();

    console.log(`Processing email: "${subject}" from ${from}`);

    // Extract events using AI
    const aiResponse = await extractEventsFromEmail({
      subject,
      from,
      date,
      htmlBody: message.htmlBody,
      textBody: message.textBody,
    });

    // Convert extracted events to ScrapedEvent format
    const scrapedEvents: ScrapedEvent[] = [];
    for (const extracted of aiResponse.events) {
      const scraped = extractedEventToScrapedEvent(extracted, {
        messageId,
        subject,
        from,
      });

      if (scraped) {
        scrapedEvents.push(scraped);
      }
    }

    console.log(
      `  ✓ Extracted ${scrapedEvents.length} events from email (${aiResponse.events.length} total, ${aiResponse.events.length - scrapedEvents.length} filtered out)`
    );

    return {
      messageId,
      subject,
      from,
      events: scrapedEvents,
      status: 'success',
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    console.error(`  ✗ Error processing email ${messageId}:`, errorMessage);

    return {
      messageId,
      subject: 'Unknown',
      from: 'Unknown',
      events: [],
      status: 'error',
      errorMessage,
    };
  }
}

/**
 * Marks an email as processed by adding a Gmail label
 *
 * @param messageId - Gmail message ID
 * @param status - Processing status (success or error)
 */
async function markEmailAsProcessed(
  messageId: string,
  status: 'success' | 'error'
): Promise<void> {
  try {
    const labelName = `nyack-today/${status === 'success' ? 'processed' : 'error'}`;
    const label = await getOrCreateLabel(labelName);

    if (label.id) {
      await addLabels(messageId, [label.id]);
    }
  } catch (error) {
    console.error(`Failed to mark email ${messageId} as ${status}:`, error);
  }
}

/**
 * Fetches and processes emails from Gmail
 *
 * Returns all extracted events from processed emails
 *
 * @returns Array of processed emails with extracted events
 */
export async function processEmails(): Promise<{
  processedEmails: ProcessedEmail[];
  totalEvents: number;
  successCount: number;
  errorCount: number;
}> {
  const config = getConfig();

  console.log('Email processor configuration:', {
    allowedSenders: config.allowedSenders,
    maxAgeDays: config.maxAgeDays,
    maxEmailsPerRun: config.maxEmailsPerRun,
  });

  // Validate configuration
  if (config.allowedSenders.length === 0) {
    console.warn(
      'EMAIL_SENDER_ALLOWLIST is empty. No emails will be processed. Add sender emails to environment variable.'
    );
    return {
      processedEmails: [],
      totalEvents: 0,
      successCount: 0,
      errorCount: 0,
    };
  }

  // Build Gmail query
  const query = buildQuery({
    isUnread: true,
    fromEmails: config.allowedSenders,
    excludeLabels: ['nyack-today/processed', 'nyack-today/error'],
    afterDaysAgo: config.maxAgeDays,
  });

  console.log('Gmail query:', query);

  // Fetch messages
  const messages = await listMessages({
    query,
    maxResults: config.maxEmailsPerRun,
  });

  console.log(`Found ${messages.length} unprocessed emails`);

  if (messages.length === 0) {
    return {
      processedEmails: [],
      totalEvents: 0,
      successCount: 0,
      errorCount: 0,
    };
  }

  // Process each email
  const processedEmails: ProcessedEmail[] = [];
  let successCount = 0;
  let errorCount = 0;

  for (const message of messages) {
    if (!message.id) continue;

    const result = await processEmail(message.id);
    processedEmails.push(result);

    // Mark email with appropriate label
    await markEmailAsProcessed(message.id, result.status);

    if (result.status === 'success') {
      successCount++;
    } else {
      errorCount++;
    }
  }

  // Count total events
  const totalEvents = processedEmails.reduce(
    (sum, email) => sum + email.events.length,
    0
  );

  console.log(`Email processing complete:`, {
    totalEmails: messages.length,
    successCount,
    errorCount,
    totalEvents,
  });

  return {
    processedEmails,
    totalEvents,
    successCount,
    errorCount,
  };
}
