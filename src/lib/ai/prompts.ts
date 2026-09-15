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
- imageUrl: Image URL for event poster/photo
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

6. **IMPORTANT - Extract URLs from email:**
   - eventUrl: Look for event registration/ticket/info links
     * Eventbrite, Ticketmaster, Facebook Events, Meetup
     * Venue websites with event details
     * "Register here", "Buy tickets", "More info", "RSVP"
     * RunSignUp, ShowClix, TicketWeb, Dice.fm
     * Any clickable link related to the event
   - imageUrl: Extract event poster/photo URLs
     * From <img> tags (src attribute)
     * From direct image links (ending in .jpg, .png, .webp, etc.)
     * Choose the most relevant/largest event image
     * Prefer event posters over logos or decorative images

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
 * System prompt for extracting events from a web page reduced to readable text.
 *
 * Used by the config-driven generic scraper (src/lib/scrapers/generic.ts), which
 * feeds it venue calendars, "upcoming events" pages, and RSS item bodies. The
 * rules differ from the email prompt in three ways that matter: the page gives
 * no reliable "sent date" so today's date is supplied explicitly, year-less and
 * relative dates are the norm on venue calendars, and recurring boilerplate
 * ("every Tuesday") must be skipped because those are hand-curated separately.
 */
export const WEBPAGE_SYSTEM_PROMPT = `You are an event extraction specialist for Nyack, NY.

You are given the readable text of a web page (a venue calendar, an "upcoming
events" listing, or a feed item). Extract the events it announces and return
structured JSON.

**Required fields:**
- title: Event name
- startDate: ISO 8601 datetime (e.g., "2026-03-15T19:00:00-04:00")
- venue: Location name
- city: City name

**Optional fields:**
- description: Short event description
- endDate: ISO 8601 datetime
- address: Street address
- price: Price string (e.g., "$20", "Free", "$15-$30")
- imageUrl: Absolute URL of the event's image, if the page shows one
- eventUrl: URL of the event's own page (tickets/registration/details)

**Rules:**

1. DATES. Today's date and the timezone (America/New_York) are given below.
   Resolve every relative date ("this Friday", "tonight", "next Saturday") and
   every year-less date ("Oct 12", "10/12") against that reference date. A
   year-less date that has already passed this year belongs to the NEXT
   occurrence of that month/day, not the past one. Always emit an explicit
   Eastern offset (-05:00 in winter, -04:00 in daylight saving time).

2. Ignore events whose date is in the past relative to the reference date.

3. ONLY return events with a specific calendar date. Skip open-ended recurring
   listings ("every Tuesday", "Saturdays at 10am", "ongoing through June")
   unless the page states a concrete next date for them — recurring events are
   curated by hand elsewhere. Skip exhibitions/date ranges with no event time
   unless they have a specific opening or reception date.

4. If a time is genuinely absent but the date is certain, use 19:00:00 (7 PM).
   Never invent a date. If you cannot determine a confident, specific date,
   leave the event out.

5. VENUE. A default venue may be given below — use it when the page is the
   venue's own site and the listing does not name a more specific room or
   location. Use the default city unless the page names a different one.

6. URLS. Links appear inline as [text](url). Prefer the event's own page for
   eventUrl; if the listing has no link of its own, use the source URL given
   below. Images appear as ![alt](url) — use one only when it clearly belongs
   to the event.

7. Only extract events in the Nyack area: Nyack, South Nyack, Upper Nyack,
   West Nyack, Valley Cottage, Piermont, Tarrytown, Sleepy Hollow, Irvington.

8. Ignore navigation, newsletter sign-ups, donation appeals, staff bios, hours,
   and past-event recaps.

9. Return an empty events array rather than guessing. A missing event costs
   less than a wrong one.

10. Return ONLY valid JSON, no markdown formatting, no explanations.

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
 * Builds the user prompt for a web page reduced to readable text.
 */
export function buildWebPagePrompt(params: {
  sourceName: string;
  url: string;
  text: string;
  defaultVenue?: string | null;
  defaultAddress?: string | null;
  defaultCity?: string | null;
  defaultCategory?: string | null;
  today: string;
}): string {
  const lines = [
    `Source: ${params.sourceName}`,
    `Source URL: ${params.url}`,
    `Today's date (America/New_York): ${params.today}`,
  ];

  if (params.defaultVenue) {
    lines.push(`Default venue for this source: ${params.defaultVenue}`);
  }
  if (params.defaultAddress) {
    lines.push(`Default address: ${params.defaultAddress}`);
  }
  if (params.defaultCity) {
    lines.push(`Default city: ${params.defaultCity}`);
  }
  if (params.defaultCategory) {
    lines.push(
      `This source usually posts ${params.defaultCategory} events (a hint, not a rule).`
    );
  }

  return `${lines.join('\n')}

Page text:
${params.text}`;
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
