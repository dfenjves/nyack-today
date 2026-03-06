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
