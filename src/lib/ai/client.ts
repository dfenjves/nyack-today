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

/**
 * Instagram-specific system prompt for event extraction
 *
 * Derived from DISCORD_SYSTEM_PROMPT with added guidance for Instagram's quirks:
 * relative dates in captions, the account being a strong venue hint, and lots
 * of non-event promotional content.
 */
const INSTAGRAM_SYSTEM_PROMPT = `You are an event extraction specialist for Nyack, NY.

Extract event information from Instagram posts (caption + image) and return structured JSON.

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
- imageUrl: leave null — the post image is attached automatically and stored separately
- eventUrl: Ticket/registration/info URL if present in the caption

**Rules:**
1. Only extract events in the Nyack area:
   - Nyack, South Nyack, Upper Nyack, West Nyack
   - Valley Cottage, Piermont
   - Tarrytown, Sleepy Hollow, Irvington
   - Nyack, NY 10960 area

2. RELATIVE DATES: Instagram captions use relative dates ("this Friday",
   "tonight", "6/6 @ 7", "next Saturday"). Resolve them to a concrete ISO 8601
   datetime in America/New_York using the POST DATE provided below as the
   reference point. If you cannot determine a confident, specific FUTURE date
   and time, DO NOT emit the event — a missed event is better than a
   wrong-date event. If time is genuinely unknown but the date is confident,
   default to 19:00:00 (7 PM).

3. VENUE HINT: The Instagram account usually IS the venue. A "Known venue for
   this account" is provided below — use it as the venue when the caption does
   not name a more specific one.

4. Skip past events (before the post date).

5. Instagram posts are mostly NON-EVENTS. Return an empty events array for
   food photos, staff/team shots, "link in bio" promos with no date, generic
   marketing, throwback posts, and menu announcements. Only extract posts that
   announce a specific, dated, upcoming happening.

6. Read the image too (flyers/posters often carry the date, time, and price
   that the caption omits).

7. Extract ticket/registration/info URLs from the caption into eventUrl when
   present (Instagram hides real links, so "link in bio" is NOT a usable URL).

8. Return ONLY valid JSON, no markdown formatting, no explanations.

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
 * Builds an Anthropic image content block from an image URL.
 * Instagram images are passed as `data:` URLs (fetched + inlined by the caller,
 * because Instagram's CDN rejects third-party downloaders); everything else is
 * passed as a plain URL source.
 */
type AnthropicMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

function toAnthropicImageBlock(imageUrl: string):
  | { type: 'image'; source: { type: 'url'; url: string } }
  | { type: 'image'; source: { type: 'base64'; media_type: AnthropicMediaType; data: string } } {
  if (imageUrl.startsWith('data:')) {
    const match = imageUrl.match(/^data:([^;]+);base64,(.*)$/);
    if (match) {
      const allowed: AnthropicMediaType[] = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
      ];
      const media_type = (allowed as string[]).includes(match[1])
        ? (match[1] as AnthropicMediaType)
        : 'image/jpeg';
      return {
        type: 'image',
        source: { type: 'base64', media_type, data: match[2] },
      };
    }
  }
  return { type: 'image', source: { type: 'url', url: imageUrl } };
}

/**
 * Builds the user prompt text for an Instagram post
 */
function buildInstagramPrompt(post: {
  caption: string;
  handle: string;
  postedAt: string;
  venueHint?: string | null;
  imageUrls: string[];
}): string {
  const venueLine = post.venueHint
    ? `Known venue for this account: ${post.venueHint}`
    : 'Known venue for this account: (unknown — infer from caption/image)';

  // Note the image COUNT only — the images themselves are attached as separate
  // image blocks. Never inline the URLs/data here (data URLs are huge and would
  // blow up the text token count).
  const imageLine =
    post.imageUrls.length > 0
      ? `\n\n(${post.imageUrls.length} post image(s) attached — read them for event details.)`
      : '';

  return `Instagram post from @${post.handle}
Post date (reference for relative dates): ${post.postedAt}
${venueLine}

Caption:
${post.caption || '(No caption — see attached image)'}${imageLine}`;
}

/**
 * Extracts events from an Instagram post using OpenAI Vision
 */
async function extractFromInstagramWithOpenAI(
  post: {
    caption: string;
    handle: string;
    postedAt: string;
    venueHint?: string | null;
    imageUrls: string[];
  },
  config: AIConfig
): Promise<AIEventExtractionResponse> {
  const client = createOpenAIClient();

  const messageContent: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail: 'low' | 'high' | 'auto' } }
  > = [{ type: 'text', text: buildInstagramPrompt(post) }];

  for (const imageUrl of post.imageUrls) {
    // detail: 'low' keeps each image at ~85 tokens (vs ~770 at high). Instagram
    // flyers are legible at low detail, and it keeps us under tight TPM limits.
    messageContent.push({ type: 'image_url', image_url: { url: imageUrl, detail: 'low' } });
  }

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o', // Force gpt-4o for vision
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      messages: [
        { role: 'system', content: INSTAGRAM_SYSTEM_PROMPT },
        { role: 'user', content: messageContent },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    return parseAIResponse(content);
  } catch (error) {
    throw new AIExtractionError(
      `OpenAI Instagram extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'openai',
      error
    );
  }
}

/**
 * Extracts events from an Instagram post using Anthropic Claude Vision
 */
async function extractFromInstagramWithAnthropic(
  post: {
    caption: string;
    handle: string;
    postedAt: string;
    venueHint?: string | null;
    imageUrls: string[];
  },
  config: AIConfig
): Promise<AIEventExtractionResponse> {
  const client = createAnthropicClient();

  const messageContent: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; source: { type: 'url'; url: string } }
    | { type: 'image'; source: { type: 'base64'; media_type: AnthropicMediaType; data: string } }
  > = [{ type: 'text', text: buildInstagramPrompt(post) }];

  for (const imageUrl of post.imageUrls) {
    messageContent.push(toAnthropicImageBlock(imageUrl));
  }

  try {
    const response = await client.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      system: INSTAGRAM_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: messageContent }],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in Claude response');
    }

    return parseAIResponse(textContent.text);
  } catch (error) {
    throw new AIExtractionError(
      `Anthropic Instagram extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'anthropic',
      error
    );
  }
}

/**
 * Extracts events from an Instagram post using the configured AI provider
 *
 * Uses Vision to read both caption and post image. Falls back to the secondary
 * provider if the primary fails.
 *
 * @param post - Instagram post caption, metadata, and image URLs
 * @returns Extracted events
 */
export async function extractEventsFromInstagram(post: {
  caption: string;
  handle: string;
  postedAt: string;
  venueHint?: string | null;
  imageUrls: string[];
}): Promise<AIEventExtractionResponse> {
  // Skip if both caption and images are empty
  if (!post.caption && post.imageUrls.length === 0) {
    return { events: [] };
  }

  const config = getAIConfig();

  // Override with Instagram-specific settings if provided
  if (process.env.INSTAGRAM_AI_PROVIDER) {
    config.provider = process.env.INSTAGRAM_AI_PROVIDER as AIProvider;
  }
  if (process.env.INSTAGRAM_AI_MODEL) {
    config.model = process.env.INSTAGRAM_AI_MODEL;
  }

  // Try primary provider
  try {
    if (config.provider === 'openai') {
      return await extractFromInstagramWithOpenAI(post, config);
    } else {
      return await extractFromInstagramWithAnthropic(post, config);
    }
  } catch (primaryError) {
    console.warn(
      `Primary AI provider (${config.provider}) failed for Instagram extraction, trying fallback`,
      primaryError
    );

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
        return await extractFromInstagramWithOpenAI(post, fallbackConfig);
      } else {
        return await extractFromInstagramWithAnthropic(post, fallbackConfig);
      }
    } catch {
      // Both providers failed, throw original error
      throw primaryError;
    }
  }
}
