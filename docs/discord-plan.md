# Discord Event Integration - Design Document

**Date:** 2026-03-16
**Status:** Approved
**Author:** Claude (with user approval)

## Overview

Add Discord integration to Nyack Today to automatically ingest events posted in a local Discord server. Events are extracted from free-form text messages and event poster images using AI (OpenAI Vision API), then routed through the existing EventSubmission approval workflow.

## Context

Nyack Today currently scrapes 8+ event sources (venues, calendars, ticketing platforms). A local Discord server has community members posting 5-10 events per week in both a dedicated #events channel and general chat. Events are shared as:
- Free-form text messages (no structured format)
- Event poster images (JPG/PNG flyers)

The user is pursuing admin access to the Discord server to enable bot integration.

## Goals

1. Automatically extract event data from Discord messages
2. Handle both text and image-based event posts
3. Route extracted events through admin review queue (EventSubmission workflow)
4. Periodic checking (every 6 hours) rather than real-time
5. Reuse existing AI infrastructure (OpenAI API, same as email scraper)

## Non-Goals

- Real-time event ingestion (periodic is sufficient for 5-10 events/week)
- Auto-approval of Discord events (always require manual review)
- Posting events back to Discord
- Discord notifications or interactions

## System Architecture

### High-Level Flow

```
Discord Server → Discord Bot (monitors channels) → Cron Job (periodic check) →
AI Parser (OpenAI Vision API) → EventSubmission Table → Admin Review UI (existing)
```

### Components

1. **Discord Bot**: Discord.js client that authenticates and reads messages
2. **Scheduled Job**: Node cron that runs every 6 hours (configurable)
3. **Discord Scraper**: New scraper implementing `Scraper` interface
4. **AI Event Parser**: Extension of existing `src/lib/ai/client.ts` with `extractEventsFromDiscord()`
5. **Message Tracking**: New `DiscordMessage` table to prevent duplicate processing

### Key Architectural Decisions

**Decision 1: EventSubmission vs Direct Event Creation**
- Discord events create `EventSubmission` records (not `Event` records)
- Rationale: Free-form Discord messages need human review for accuracy
- Follows same pattern as email scraper

**Decision 2: Periodic Checking vs Real-Time**
- Scraper runs every 6 hours (configurable)
- Rationale: 5-10 events/week volume doesn't justify real-time complexity
- Simpler infrastructure, no persistent websocket connection

**Decision 3: OpenAI Vision API for Extraction**
- Use gpt-4o (Vision) to process both text and images in one API call
- Rationale: Reuses existing AI infrastructure, handles event poster OCR
- Cost: ~$0.01-0.05 per message

## Database Schema

### New Table: DiscordMessage

Tracks processed Discord messages to prevent duplicates and enable debugging.

```prisma
model DiscordMessage {
  id              String   @id @default(cuid())

  // Discord metadata
  messageId       String   @unique  // Discord snowflake ID
  channelId       String              // Which channel this came from
  channelName     String              // Human-readable channel name
  authorId        String              // Discord user ID who posted
  authorName      String              // Discord username
  content         String   @db.Text   // Message text content
  attachmentUrls  String[] @default([]) // Array of image URLs
  postedAt        DateTime            // When message was posted to Discord

  // Processing metadata
  processedAt     DateTime @default(now())
  status          String   // "success", "error", "no_events"
  eventsExtracted Int      @default(0)
  errorMessage    String?

  @@index([channelId])
  @@index([processedAt])
  @@index([status])
}
```

**Schema Notes:**
- `messageId` is unique to prevent reprocessing
- `attachmentUrls` array stores image URLs for OCR
- `status` tracks extraction outcome:
  - "success": extracted 1+ events
  - "no_events": processed successfully but found no events
  - "error": AI extraction or API call failed

### Existing Tables Modified

**EventSubmission** - No schema changes required
- Add new source indicator in application code: `sourceName: "Discord"`
- Link back to DiscordMessage via `sourceUrl: discord:${messageId}`

## Configuration

### Environment Variables

```bash
# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_GUILD_ID=your_server_id_here
DISCORD_MONITORED_CHANNELS=["channel-id-1", "channel-id-2"]  # JSON array
DISCORD_SCRAPER_ENABLED=true
DISCORD_SCRAPER_INTERVAL_HOURS=6  # How often to check for new messages

# Optional: Override global AI settings for Discord
DISCORD_AI_PROVIDER=openai  # or anthropic (defaults to AI_PROVIDER)
DISCORD_AI_MODEL=gpt-4o     # defaults to AI_MODEL
```

### Discord Bot Setup

**Required Permissions:**
- Read Message History
- View Channels
- Read Messages/View Channels (for monitored channels)

**Setup Steps:**
1. Create Discord bot via Discord Developer Portal
2. Enable "Message Content Intent" (required to read message text)
3. Generate bot token, add to `DISCORD_BOT_TOKEN` env var
4. Invite bot to server with read permissions
5. Get channel IDs (right-click channel → Copy ID with Developer Mode enabled)
6. Add channel IDs to `DISCORD_MONITORED_CHANNELS`

## Implementation Details

### File Structure

```
src/lib/discord/
  ├── client.ts         # Discord.js bot setup, message fetching
  ├── processor.ts      # Message processing pipeline
  └── types.ts          # Discord-specific types

src/lib/scrapers/
  └── discord.ts        # Scraper interface implementation

src/lib/ai/
  └── client.ts         # Add extractEventsFromDiscord() function
```

### Discord Client (`src/lib/discord/client.ts`)

**Responsibilities:**
- Initialize Discord.js client with bot token
- Authenticate and maintain connection
- Fetch messages from channels
- Handle rate limits and pagination

**Key Functions:**
```typescript
export async function fetchMessagesSince(
  channelIds: string[],
  since: Date
): Promise<DiscordMessageData[]>

export async function getChannelInfo(
  channelId: string
): Promise<{ id: string; name: string }>
```

### Discord Processor (`src/lib/discord/processor.ts`)

**Responsibilities:**
- Orchestrate message processing pipeline
- Query for unprocessed messages
- Call AI extraction
- Create EventSubmission records
- Save DiscordMessage records

**Key Function:**
```typescript
export async function processDiscordMessages(): Promise<{
  processedMessages: ProcessedDiscordMessage[];
  totalSubmissions: number;
  successCount: number;
  errorCount: number;
}>
```

**Processing Flow:**
1. Get last successful scraper run timestamp from ScraperLog
2. Fetch messages from monitored channels posted since last run
3. For each message:
   - Check if messageId exists in DiscordMessage table (skip if yes)
   - Extract text content and attachment URLs
   - Call `extractEventsFromDiscord()` AI function
   - Convert extracted events to EventSubmission records
   - Save DiscordMessage record with status
4. Return summary statistics

### AI Extraction (`src/lib/ai/client.ts`)

**New Function:**
```typescript
export async function extractEventsFromDiscord(discordMessage: {
  content: string;
  authorName: string;
  postedAt: string;
  channelName: string;
  attachmentUrls: string[];
}): Promise<AIEventExtractionResponse>
```

**Implementation Details:**
- Use OpenAI Vision API (gpt-4o model)
- Single API call processes both text and images
- Prompt instructs AI to:
  - Extract event details from text message
  - OCR event posters from images
  - Return structured JSON (same format as email extraction)
  - Be lenient with missing optional fields (description, price)
  - Return empty array if no events found

**Differences from Email Extraction:**
- Discord messages shorter and less structured than newsletters
- May extract 0 events (casual chat is normal)
- Images are event posters, not inline content
- Prompt more tolerant of incomplete event data

### Discord Scraper (`src/lib/scrapers/discord.ts`)

**Implementation:**
```typescript
export const discordScraper: Scraper = {
  name: 'Discord',

  async scrape(): Promise<ScraperResult> {
    // Check if enabled
    if (process.env.DISCORD_SCRAPER_ENABLED !== 'true') {
      return { sourceName: 'Discord', events: [], status: 'error',
               errorMessage: 'Discord scraper disabled' };
    }

    // Process messages
    const result = await processDiscordMessages();

    // Return scraper result
    return {
      sourceName: 'Discord',
      events: [], // Discord creates EventSubmissions, not Events
      status: result.errorCount === 0 ? 'success' : 'partial',
      errorMessage: result.errorCount > 0
        ? `${result.errorCount} messages failed`
        : undefined
    };
  }
}
```

**Key Difference from Other Scrapers:**
- Returns empty `events` array (doesn't populate Event table directly)
- Creates EventSubmission records instead
- ScraperLog tracks submissions created, not events added

## Error Handling

### Graceful Degradation

1. **Bot not in server / missing permissions:**
   - Return scraper error status
   - Log: "Discord bot not authorized. Check DISCORD_BOT_TOKEN and bot permissions."
   - Don't crash entire scraper run

2. **AI extraction fails:**
   - Save DiscordMessage with status="error" and errorMessage
   - Don't retry automatically (avoid burning API credits)
   - Admin can manually retry via admin panel

3. **Invalid channel IDs:**
   - Skip invalid channels, log warning
   - Continue processing valid channels

4. **Rate limiting:**
   - Discord API: max 50 requests/second
   - Implement exponential backoff
   - For 6-hour intervals, rate limits unlikely

### Edge Cases

1. **Messages with no events (casual chat):**
   - Save DiscordMessage with status="no_events"
   - Don't create EventSubmission records
   - Prevents reprocessing same message

2. **Messages with multiple events:**
   - Extract all events from single message
   - Create separate EventSubmission for each event
   - Track count in DiscordMessage.eventsExtracted

3. **Duplicate events across messages:**
   - Don't handle at scraper level
   - Rely on admin review to catch duplicates
   - EventSubmission workflow allows admin to reject

4. **Past events:**
   - AI might extract events with startDate in the past
   - Filter these out before creating EventSubmissions
   - Same logic as email processor

5. **Missing required fields:**
   - AI extraction might miss venue, date, or title
   - Skip incomplete events (don't create EventSubmission)
   - Log as "partial extraction" in DiscordMessage

## Monitoring & Admin UI

### Scraper Logging

Discord scraper writes to existing `ScraperLog` table:
- `sourceName`: "Discord"
- `eventsFound`: Total EventSubmissions created
- `eventsAdded`: 0 (submissions need approval)
- `status`: "success" / "error" / "partial"

### New Admin Panel Views

**1. Discord Messages Log (`/admin/discord-messages`)**
- Table showing recent DiscordMessage records
- Columns: Channel, Author, Posted Date, Status, Events Extracted, Message Preview
- Filter by: channel, status, date range
- Click message to see full content + extracted events
- "Retry Failed" button for error status messages

**2. Enhanced Event Submissions View (`/admin/submissions`)**
- Add "Source" column: Manual Form / Email / Discord
- Include link back to source (DiscordMessage or Gmail message)
- Filter by source type

**3. Discord Settings (`/admin/discord-settings`)**
- View/edit monitored channels
- Test bot connection
- Manual trigger: "Sync Discord Now" button
- Display last successful sync time

### Observability Metrics

- Track AI API costs per message (log tokens used)
- Monitor extraction success rate (status="success" / total messages)
- Alert if error rate > 50% over 24 hours

## Testing Strategy

### Unit Tests

1. **Discord Client:**
   - Mock Discord.js API responses
   - Test message fetching with pagination
   - Test channel info retrieval
   - Test error handling (invalid channels, auth failures)

2. **Discord Processor:**
   - Test message deduplication (skip already processed)
   - Test EventSubmission creation from extracted events
   - Test filtering past events
   - Test handling messages with 0, 1, or multiple events

3. **AI Extraction:**
   - Test text-only messages
   - Test image-only messages (event posters)
   - Test combined text + images
   - Test malformed/unclear content (should return empty array)

### Integration Tests

1. **End-to-end scraper flow:**
   - Mock Discord API with sample messages
   - Verify DiscordMessage records created
   - Verify EventSubmission records created
   - Verify ScraperLog entries

2. **Admin UI:**
   - Test Discord messages log rendering
   - Test manual retry functionality
   - Test manual sync trigger

### Manual Testing

1. Set up test Discord server with sample events
2. Run scraper and verify extraction accuracy
3. Test edge cases: unclear text, low-quality images, past events
4. Verify admin review workflow

## Security & Privacy

### Data Retention

- DiscordMessage records stored indefinitely for debugging
- Contains: usernames, message content, timestamps
- No sensitive data (passwords, emails, phone numbers)

### API Key Security

- DISCORD_BOT_TOKEN must be kept secret
- Bot has read-only permissions (can't post/delete)
- OpenAI API key reused from existing setup

### Privacy Considerations

- Bot only reads messages from configured channels
- Discord usernames stored but not exposed publicly
- Events posted publicly on Nyack Today don't include Discord author

## Cost Analysis

### OpenAI API Costs

- Model: gpt-4o (Vision)
- Average cost: ~$0.02-0.05 per message with images
- Volume: 5-10 events/week = ~40 messages/month
- Estimated monthly cost: **$0.80 - $2.00**

### Infrastructure Costs

- Discord bot: Free (no hosting needed, bot runs during scraper cron)
- Database: Minimal increase (DiscordMessage + EventSubmission rows)
- No additional hosting costs

## Rollout Plan

### Phase 1: Core Implementation
- Implement Discord client, processor, and scraper
- Add AI extraction function
- Create DiscordMessage table migration
- Basic admin UI (messages log)

### Phase 2: Admin Features
- Enhanced EventSubmissions view with source filtering
- Discord settings page
- Manual retry functionality
- Manual sync trigger

### Phase 3: Monitoring & Optimization
- Add observability metrics
- Tune AI prompts based on extraction accuracy
- Monitor costs and adjust model if needed

### Phase 4: Expansion (Optional Future)
- Support more Discord servers
- React emoji voting for events (community curation)
- Auto-post approved events back to Discord

## Success Metrics

- **Extraction Accuracy**: >80% of posted events correctly extracted
- **False Positives**: <10% of extractions are non-events
- **Admin Review Time**: Discord submissions take same time as email submissions
- **Uptime**: Scraper runs successfully >95% of scheduled times
- **Cost**: Stay under $5/month for OpenAI API costs

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Discord changes bot API | High | Use stable Discord.js library, monitor changelog |
| AI extraction poor quality | Medium | Tune prompts, fall back to admin filling details manually |
| Cost overruns from spam messages | Medium | Filter channels carefully, set max messages per run |
| Bot loses permissions | High | Monitor scraper errors, alert if auth fails |
| Duplicate events from multiple channels | Low | Admin review catches duplicates |

## Future Enhancements

1. **Community Voting**: React with 👍 to boost event visibility
2. **Multi-Server Support**: Monitor multiple Discord communities
3. **Smart Channel Detection**: Auto-discover new event-related channels
4. **Bi-directional Sync**: Post approved events back to Discord
5. **Event Reminders**: Discord bot sends reminders for upcoming events
