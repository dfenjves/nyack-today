/**
 * AI Event Extraction Client
 *
 * Handles calling AI APIs (Anthropic Claude or OpenAI GPT) to extract
 * structured event data from email content
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import {
  AIConfig,
  AIEventExtractionResponse,
  AIExtractionError,
  AIProvider,
} from './types';
import { SYSTEM_PROMPT, buildUserPrompt, cleanEmailHtml } from './prompts';

/**
 * Gets AI configuration from environment variables
 */
function getAIConfig(): AIConfig {
  const provider = (process.env.AI_PROVIDER || 'openai') as AIProvider;
  const model =
    process.env.AI_MODEL ||
    (provider === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet-20241022');
  const maxTokens = parseInt(process.env.AI_MAX_TOKENS || '4096', 10);
  const temperature = parseFloat(process.env.AI_TEMPERATURE || '0.1');

  return {
    provider,
    model,
    maxTokens,
    temperature,
  };
}

/**
 * Creates Anthropic client
 */
function createAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set in environment variables');
  }

  return new Anthropic({ apiKey });
}

/**
 * Creates OpenAI client
 */
function createOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set in environment variables');
  }

  return new OpenAI({ apiKey });
}

/**
 * Extracts events from email content using Anthropic Claude
 */
async function extractWithAnthropic(
  emailContent: {
    subject: string;
    from: string;
    date: string;
    body: string;
  },
  config: AIConfig
): Promise<AIEventExtractionResponse> {
  const client = createAnthropicClient();

  const userPrompt = buildUserPrompt(emailContent);

  try {
    const response = await client.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Extract text from response
    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in Claude response');
    }

    // Parse JSON response
    const parsed = parseAIResponse(textContent.text);
    return parsed;
  } catch (error) {
    throw new AIExtractionError(
      `Anthropic extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'anthropic',
      error
    );
  }
}

/**
 * Extracts events from email content using OpenAI GPT
 */
async function extractWithOpenAI(
  emailContent: {
    subject: string;
    from: string;
    date: string;
    body: string;
  },
  config: AIConfig
): Promise<AIEventExtractionResponse> {
  const client = createOpenAIClient();

  const userPrompt = buildUserPrompt(emailContent);

  try {
    const response = await client.chat.completions.create({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    // Parse JSON response
    const parsed = parseAIResponse(content);
    return parsed;
  } catch (error) {
    throw new AIExtractionError(
      `OpenAI extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'openai',
      error
    );
  }
}

/**
 * Parses AI response text as JSON and validates structure
 */
function parseAIResponse(text: string): AIEventExtractionResponse {
  // Remove markdown code blocks if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\n/, '').replace(/\n```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\n/, '').replace(/\n```$/, '');
  }

  try {
    const parsed = JSON.parse(cleaned) as AIEventExtractionResponse;

    // Validate structure
    if (!parsed.events || !Array.isArray(parsed.events)) {
      throw new Error('Response missing "events" array');
    }

    // Validate each event has required fields
    for (const event of parsed.events) {
      if (!event.title || !event.startDate || !event.venue || !event.city) {
        throw new Error(
          `Event missing required fields: ${JSON.stringify(event)}`
        );
      }
    }

    return parsed;
  } catch (error) {
    throw new Error(
      `Failed to parse AI response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}\n\nRaw response: ${text.substring(0, 500)}`
    );
  }
}

/**
 * Extracts events from email content using configured AI provider
 *
 * Automatically falls back to secondary provider if primary fails
 *
 * @param emailContent - Email metadata and body
 * @returns Extracted events
 */
export async function extractEventsFromEmail(emailContent: {
  subject: string;
  from: string;
  date: string;
  htmlBody?: string;
  textBody?: string;
}): Promise<AIEventExtractionResponse> {
  const config = getAIConfig();

  // Prefer HTML body, fallback to text
  const body = emailContent.htmlBody
    ? cleanEmailHtml(emailContent.htmlBody)
    : emailContent.textBody || '';

  if (!body) {
    return { events: [] };
  }

  const content = {
    subject: emailContent.subject,
    from: emailContent.from,
    date: emailContent.date,
    body,
  };

  // Try primary provider
  try {
    if (config.provider === 'openai') {
      return await extractWithOpenAI(content, config);
    } else {
      return await extractWithAnthropic(content, config);
    }
  } catch (primaryError) {
    console.warn(
      `Primary AI provider (${config.provider}) failed, trying fallback`,
      primaryError
    );

    // Try fallback provider
    const fallbackProvider: AIProvider =
      config.provider === 'openai' ? 'anthropic' : 'openai';

    try {
      const fallbackConfig: AIConfig = {
        ...config,
        provider: fallbackProvider,
        model:
          fallbackProvider === 'openai'
            ? 'gpt-4o'
            : 'claude-3-5-sonnet-20241022',
      };

      if (fallbackProvider === 'openai') {
        return await extractWithOpenAI(content, fallbackConfig);
      } else {
        return await extractWithAnthropic(content, fallbackConfig);
      }
    } catch (fallbackError) {
      // Both providers failed, throw original error
      throw primaryError;
    }
  }
}

/**
 * Discord-specific system prompt for event extraction
 */
const DISCORD_SYSTEM_PROMPT = `You are an event extraction specialist for Nyack, NY.

Extract event information from Discord messages and event poster images, then return structured JSON.

**Required fields:**
- title: Event name
- startDate: ISO 8601 datetime (e.g., "2026-03-15T19:00:00-04:00")
- venue: Location name
- city: City name

**Optional fields:**
- description: Event description
- endDate: ISO 8601 datetime
- address: Street address
- price: Price string (e.g., "$20", "Free", "$15-$30")
- imageUrl: Event poster image URL (IMPORTANT: If the Discord message has image attachments, use the attachment URL as the imageUrl)
- eventUrl: URL for event registration, tickets, or more info (extract from message links)

**Rules:**
1. Only extract events in the Nyack area:
   - Nyack, South Nyack, Upper Nyack, West Nyack
   - Valley Cottage, Piermont
   - Tarrytown, Sleepy Hollow, Irvington
   - Nyack, NY 10960 area

2. Skip past events (before today)

3. Be lenient with incomplete information:
   - If time is missing, use 19:00:00 (7 PM) as default
   - If price is unclear, leave as null
   - If description is minimal, that's okay

4. Process both text content and attached images:
   - Extract event details from poster images using OCR
   - Combine information from text and images
   - IMPORTANT: If the message has image attachments, use the attachment URL(s) as the imageUrl field for the extracted event(s)

5. Discord messages are often casual:
   - May be informal language ("show tonight", "gig at xyz")
   - May only have an event poster image with no text
   - May be non-event chat (return empty array if no events)

6. Extract URLs from message text:
   - Look for registration links (eventbrite, runsignup, ticketmaster, etc.)
   - Event venue websites
   - Facebook event pages
   - Any URL that provides more event information
   - Store in eventUrl field

7. Return array of events (empty array if no events found)

8. Return ONLY valid JSON, no markdown formatting, no explanations

**Output JSON schema:**
{
  "events": [
    {
      "title": "string",
      "description": "string | null",
      "startDate": "ISO 8601 string",
      "endDate": "ISO 8601 string | null",
      "venue": "string",
      "address": "string | null",
      "city": "string",
      "price": "string | null",
      "imageUrl": "string | null",
      "eventUrl": "string | null"
    }
  ]
}`;

/**
 * Extracts events from Discord message using OpenAI Vision API
 *
 * Processes both text content and attached images in a single API call
 */
async function extractFromDiscordWithOpenAI(
  discordMessage: {
    content: string;
    authorName: string;
    postedAt: string;
    channelName: string;
    attachmentUrls: string[];
  },
  config: AIConfig
): Promise<AIEventExtractionResponse> {
  const client = createOpenAIClient();

  // Build user prompt
  const attachmentText = discordMessage.attachmentUrls.length > 0
    ? `\n\nAttached Images (use these URLs as imageUrl for extracted events):\n${discordMessage.attachmentUrls.map((url, i) => `${i + 1}. ${url}`).join('\n')}`
    : '';

  const textPrompt = `Discord Message from @${discordMessage.authorName} in #${discordMessage.channelName}
Posted: ${discordMessage.postedAt}

${discordMessage.content || '(No text content - see attached images)'}${attachmentText}`;

  // Build message content with text and images
  const messageContent: Array<
    { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
  > = [{ type: 'text', text: textPrompt }];

  // Add image attachments
  for (const imageUrl of discordMessage.attachmentUrls) {
    messageContent.push({
      type: 'image_url',
      image_url: { url: imageUrl },
    });
  }

  try {
    const response = await client.chat.completions.create({
      model: config.model === 'gpt-4o' ? 'gpt-4o' : 'gpt-4o', // Force gpt-4o for vision
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      messages: [
        {
          role: 'system',
          content: DISCORD_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: messageContent,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    // Parse JSON response
    const parsed = parseAIResponse(content);
    return parsed;
  } catch (error) {
    throw new AIExtractionError(
      `OpenAI Discord extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'openai',
      error
    );
  }
}

/**
 * Extracts events from Discord message using Anthropic Claude Vision
 */
async function extractFromDiscordWithAnthropic(
  discordMessage: {
    content: string;
    authorName: string;
    postedAt: string;
    channelName: string;
    attachmentUrls: string[];
  },
  config: AIConfig
): Promise<AIEventExtractionResponse> {
  const client = createAnthropicClient();

  // Build user prompt with text and images
  const attachmentText = discordMessage.attachmentUrls.length > 0
    ? `\n\nAttached Images (use these URLs as imageUrl for extracted events):\n${discordMessage.attachmentUrls.map((url, i) => `${i + 1}. ${url}`).join('\n')}`
    : '';

  const textPrompt = `Discord Message from @${discordMessage.authorName} in #${discordMessage.channelName}
Posted: ${discordMessage.postedAt}

${discordMessage.content || '(No text content - see attached images)'}${attachmentText}`;

  // Build message content with text and images
  const messageContent: Array<
    { type: 'text'; text: string } | { type: 'image'; source: { type: 'url'; url: string } }
  > = [{ type: 'text', text: textPrompt }];

  // Add image attachments
  for (const imageUrl of discordMessage.attachmentUrls) {
    messageContent.push({
      type: 'image',
      source: { type: 'url', url: imageUrl },
    });
  }

  try {
    const response = await client.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      system: DISCORD_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: messageContent,
        },
      ],
    });

    // Extract text from response
    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in Claude response');
    }

    // Parse JSON response
    const parsed = parseAIResponse(textContent.text);
    return parsed;
  } catch (error) {
    throw new AIExtractionError(
      `Anthropic Discord extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'anthropic',
      error
    );
  }
}

/**
 * Extracts events from Discord message using configured AI provider
 *
 * Uses Vision API to process both text and event poster images
 *
 * @param discordMessage - Discord message metadata, content, and image attachments
 * @returns Extracted events
 */
export async function extractEventsFromDiscord(discordMessage: {
  content: string;
  authorName: string;
  postedAt: string;
  channelName: string;
  attachmentUrls: string[];
}): Promise<AIEventExtractionResponse> {
  // Skip if both content and images are empty
  if (!discordMessage.content && discordMessage.attachmentUrls.length === 0) {
    return { events: [] };
  }

  const config = getAIConfig();

  // Override with Discord-specific settings if provided
  if (process.env.DISCORD_AI_PROVIDER) {
    config.provider = process.env.DISCORD_AI_PROVIDER as AIProvider;
  }
  if (process.env.DISCORD_AI_MODEL) {
    config.model = process.env.DISCORD_AI_MODEL;
  }

  // Try primary provider
  try {
    if (config.provider === 'openai') {
      return await extractFromDiscordWithOpenAI(discordMessage, config);
    } else {
      return await extractFromDiscordWithAnthropic(discordMessage, config);
    }
  } catch (primaryError) {
    console.warn(
      `Primary AI provider (${config.provider}) failed for Discord extraction, trying fallback`,
      primaryError
    );

    // Try fallback provider
    const fallbackProvider: AIProvider =
      config.provider === 'openai' ? 'anthropic' : 'openai';

    try {
      const fallbackConfig: AIConfig = {
        ...config,
        provider: fallbackProvider,
        model:
          fallbackProvider === 'openai'
            ? 'gpt-4o'
            : 'claude-3-5-sonnet-20241022',
      };

      if (fallbackProvider === 'openai') {
        return await extractFromDiscordWithOpenAI(
          discordMessage,
          fallbackConfig
        );
      } else {
        return await extractFromDiscordWithAnthropic(
          discordMessage,
          fallbackConfig
        );
      }
    } catch (fallbackError) {
      // Both providers failed, throw original error
      throw primaryError;
    }
  }
}
