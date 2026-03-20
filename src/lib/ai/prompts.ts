/**
 * AI Event Extraction Prompts
 *
 * System and user prompts for extracting event data from email content
 */

/**
 * System prompt for AI event extraction
 *
 * Instructs the AI to extract structured event data from email content
 */
export const SYSTEM_PROMPT = `You are an event extraction specialist for Nyack, NY.

Extract event information from emails and return structured JSON.

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
- imageUrl: Image URL from email
- eventUrl: URL for event registration, tickets, or more info

**Rules:**
1. Only extract events in the Nyack area:
   - Nyack, South Nyack, Upper Nyack, West Nyack
   - Valley Cottage, Piermont
   - Tarrytown, Sleepy Hollow, Irvington
   - Nyack, NY 10960 area

2. Skip past events (before today)

3. For recurring events, extract each occurrence as separate event

4. Extract dates carefully:
   - Include time if specified
   - Use ISO 8601 format with timezone (EST/EDT is UTC-5/-4)
   - If only date is given, use 00:00:00

5. For price:
   - "Free", "0", "$0" → "Free"
   - "$20" → "$20"
   - "$15-$30" → "$15-$30"
   - "Donation" → "Donation"

6. Extract image URLs from <img> tags if present

7. Return array of events (empty array if none found)

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
 * Constructs user prompt from email metadata and body
 */
export function buildUserPrompt(params: {
  subject: string;
  from: string;
  date: string;
  body: string;
}): string {
  return `Email Subject: ${params.subject}
From: ${params.from}
Date: ${params.date}

${params.body}`;
}

/**
 * Cleans HTML content before sending to AI
 *
 * Removes tracking pixels, scripts, and other unnecessary content
 */
export function cleanEmailHtml(html: string): string {
  let cleaned = html;

  // Remove script tags
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove style tags
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove tracking pixels (1x1 images)
  cleaned = cleaned.replace(
    /<img[^>]*width=['"]?1['"]?[^>]*height=['"]?1['"]?[^>]*>/gi,
    ''
  );
  cleaned = cleaned.replace(
    /<img[^>]*height=['"]?1['"]?[^>]*width=['"]?1['"]?[^>]*>/gi,
    ''
  );

  // Remove common tracking domains
  const trackingDomains = [
    'track.customer.io',
    'click.email',
    'links.email',
    'pixel.email',
    'open.email',
  ];

  for (const domain of trackingDomains) {
    const regex = new RegExp(`<img[^>]*${domain.replace('.', '\\.')}[^>]*>`, 'gi');
    cleaned = cleaned.replace(regex, '');
  }

  // Limit length to avoid excessive token usage
  const maxLength = 50000; // ~12,500 tokens
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength) + '\n\n[Content truncated]';
  }

  return cleaned;
}

/**
 * Estimates token count for content (rough approximation)
 */
export function estimateTokenCount(content: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(content.length / 4);
}
