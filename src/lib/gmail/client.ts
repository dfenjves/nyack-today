/**
 * Gmail API Client
 *
 * Provides high-level operations for working with Gmail:
 * - Listing messages with filters
 * - Getting full message content
 * - Managing labels (create, apply, remove)
 * - Extracting email body (HTML/text)
 */

import { google, gmail_v1 } from 'googleapis';
import { getAuthenticatedClient } from './auth';

export interface EmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: gmail_v1.Schema$MessagePart;
  headers: {
    subject?: string;
    from?: string;
    to?: string;
    date?: string;
  };
  htmlBody?: string;
  textBody?: string;
}

export interface ListMessagesOptions {
  query?: string;
  maxResults?: number;
  labelIds?: string[];
}

/**
 * Creates Gmail API client instance
 */
async function getGmailClient(): Promise<gmail_v1.Gmail> {
  const auth = await getAuthenticatedClient();
  return google.gmail({ version: 'v1', auth });
}

/**
 * Lists messages matching the given filters
 *
 * @param options - Query options (query string, labels, max results)
 * @returns Array of message IDs and thread IDs
 */
export async function listMessages(
  options: ListMessagesOptions = {}
): Promise<gmail_v1.Schema$Message[]> {
  const gmail = await getGmailClient();

  const response = await gmail.users.messages.list({
    userId: 'me',
    q: options.query,
    maxResults: options.maxResults || 100,
    labelIds: options.labelIds,
  });

  return response.data.messages || [];
}

/**
 * Gets full message content including headers and body
 *
 * @param messageId - Gmail message ID
 * @returns Parsed email message with headers and body
 */
export async function getMessage(messageId: string): Promise<EmailMessage> {
  const gmail = await getGmailClient();

  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const message = response.data;

  // Extract headers
  const headers = extractHeaders(message.payload?.headers || []);

  // Extract body
  const { htmlBody, textBody } = extractBody(message.payload);

  return {
    id: message.id!,
    threadId: message.threadId!,
    labelIds: message.labelIds,
    snippet: message.snippet,
    internalDate: message.internalDate,
    payload: message.payload,
    headers,
    htmlBody,
    textBody,
  };
}

/**
 * Extracts key headers from message
 */
function extractHeaders(
  headers: gmail_v1.Schema$MessagePartHeader[]
): EmailMessage['headers'] {
  const headerMap: Record<string, string> = {};

  for (const header of headers) {
    if (header.name && header.value) {
      headerMap[header.name.toLowerCase()] = header.value;
    }
  }

  return {
    subject: headerMap['subject'],
    from: headerMap['from'],
    to: headerMap['to'],
    date: headerMap['date'],
  };
}

/**
 * Extracts HTML and text body from message payload
 */
function extractBody(
  payload?: gmail_v1.Schema$MessagePart
): { htmlBody?: string; textBody?: string } {
  if (!payload) {
    return {};
  }

  let htmlBody: string | undefined;
  let textBody: string | undefined;

  // Handle multipart messages
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        htmlBody = decodeBase64(part.body.data);
      } else if (part.mimeType === 'text/plain' && part.body?.data) {
        textBody = decodeBase64(part.body.data);
      }

      // Recursively check nested parts
      if (part.parts) {
        const nested = extractBody(part);
        if (!htmlBody && nested.htmlBody) htmlBody = nested.htmlBody;
        if (!textBody && nested.textBody) textBody = nested.textBody;
      }
    }
  }

  // Handle single-part messages
  if (!htmlBody && !textBody && payload.body?.data) {
    const body = decodeBase64(payload.body.data);
    if (payload.mimeType === 'text/html') {
      htmlBody = body;
    } else if (payload.mimeType === 'text/plain') {
      textBody = body;
    }
  }

  return { htmlBody, textBody };
}

/**
 * Decodes base64url-encoded string (Gmail uses base64url encoding)
 */
function decodeBase64(encoded: string): string {
  // Convert base64url to base64
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');

  // Decode from base64 to UTF-8
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * Lists all labels in the account
 */
export async function listLabels(): Promise<gmail_v1.Schema$Label[]> {
  const gmail = await getGmailClient();

  const response = await gmail.users.labels.list({
    userId: 'me',
  });

  return response.data.labels || [];
}

/**
 * Creates a new label
 *
 * @param labelName - Name of the label (e.g., "nyack-today/processed")
 * @returns Created label
 */
export async function createLabel(labelName: string): Promise<gmail_v1.Schema$Label> {
  const gmail = await getGmailClient();

  const response = await gmail.users.labels.create({
    userId: 'me',
    requestBody: {
      name: labelName,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    },
  });

  return response.data;
}

/**
 * Gets a label by name, creates it if it doesn't exist
 *
 * @param labelName - Name of the label
 * @returns Label object
 */
export async function getOrCreateLabel(labelName: string): Promise<gmail_v1.Schema$Label> {
  const labels = await listLabels();
  const existing = labels.find((label) => label.name === labelName);

  if (existing) {
    return existing;
  }

  return createLabel(labelName);
}

/**
 * Adds labels to a message
 *
 * @param messageId - Gmail message ID
 * @param labelIds - Array of label IDs to add
 */
export async function addLabels(messageId: string, labelIds: string[]): Promise<void> {
  const gmail = await getGmailClient();

  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      addLabelIds: labelIds,
    },
  });
}

/**
 * Removes labels from a message
 *
 * @param messageId - Gmail message ID
 * @param labelIds - Array of label IDs to remove
 */
export async function removeLabels(messageId: string, labelIds: string[]): Promise<void> {
  const gmail = await getGmailClient();

  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      removeLabelIds: labelIds,
    },
  });
}

/**
 * Marks message as read
 *
 * @param messageId - Gmail message ID
 */
export async function markAsRead(messageId: string): Promise<void> {
  await removeLabels(messageId, ['UNREAD']);
}

/**
 * Marks message as unread
 *
 * @param messageId - Gmail message ID
 */
export async function markAsUnread(messageId: string): Promise<void> {
  await addLabels(messageId, ['UNREAD']);
}

/**
 * Builds a Gmail query string from filters
 *
 * @param filters - Query filters
 * @returns Gmail query string
 */
export function buildQuery(filters: {
  isUnread?: boolean;
  fromEmails?: string[];
  excludeLabels?: string[];
  afterDaysAgo?: number;
}): string {
  const queryParts: string[] = [];

  if (filters.isUnread) {
    queryParts.push('is:unread');
  }

  if (filters.fromEmails && filters.fromEmails.length > 0) {
    const fromQuery = filters.fromEmails.map((email) => `from:${email}`).join(' OR ');
    queryParts.push(`(${fromQuery})`);
  }

  if (filters.excludeLabels && filters.excludeLabels.length > 0) {
    for (const label of filters.excludeLabels) {
      queryParts.push(`-label:${label}`);
    }
  }

  if (filters.afterDaysAgo) {
    const date = new Date();
    date.setDate(date.getDate() - filters.afterDaysAgo);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    queryParts.push(`after:${dateStr}`);
  }

  return queryParts.join(' ');
}
