# Discord Integration Setup Guide

This guide walks you through setting up the Discord bot for automatic event extraction from Discord messages.

## Overview

The Discord integration allows Nyack Today to automatically monitor Discord channels for event posts. Events are extracted from both text messages and event poster images using AI (OpenAI Vision or Anthropic Claude), then routed through the admin review queue as EventSubmissions.

## Prerequisites

- Admin access to the Discord server you want to monitor
- OpenAI API key (for Vision API) or Anthropic API key
- Discord Developer Portal access

## Step 1: Create Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Give it a name (e.g., "Nyack Today Events Bot")
4. Go to "Bot" section in the left sidebar
5. Click "Add Bot" → "Yes, do it!"

## Step 2: Configure Bot Permissions

1. In the "Bot" section, enable these **Privileged Gateway Intents**:
   - ✅ **Message Content Intent** (Required to read message text)
   - ✅ **Server Members Intent** (Optional)
   - ✅ **Presence Intent** (Optional)

2. Save changes

## Step 3: Get Bot Token

1. In the "Bot" section, click "Reset Token"
2. Copy the token (it will only be shown once!)
3. Add to your `.env.local`:
   ```
   DISCORD_BOT_TOKEN=your_token_here
   ```

**Important:** Never commit this token to version control!

## Step 4: Invite Bot to Server

1. Go to "OAuth2" → "URL Generator" in the left sidebar
2. Select these **Scopes**:
   - `bot`
3. Select these **Bot Permissions**:
   - Read Messages/View Channels
   - Read Message History
   - View Channels
4. Copy the generated URL
5. Open the URL in your browser
6. Select your Discord server
7. Authorize the bot

## Step 5: Get Server and Channel IDs

### Enable Developer Mode
1. Open Discord
2. Go to User Settings (gear icon)
3. Advanced → Enable "Developer Mode"

### Get Server (Guild) ID
1. Right-click on the server name
2. Click "Copy Server ID"
3. Add to `.env.local`:
   ```
   DISCORD_GUILD_ID=your_guild_id_here
   ```

### Get Channel IDs
1. Right-click on each channel you want to monitor
2. Click "Copy Channel ID"
3. Add all channel IDs to `.env.local` as a JSON array:
   ```
   DISCORD_MONITORED_CHANNELS='["1234567890123456789", "9876543210987654321"]'
   ```

## Step 6: Configure Environment Variables

Add these to your `.env.local` file:

```bash
# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_GUILD_ID=your_server_id_here
DISCORD_MONITORED_CHANNELS='["channel-id-1", "channel-id-2"]'
DISCORD_SCRAPER_ENABLED=true
DISCORD_SCRAPER_INTERVAL_HOURS=6

# Optional: Override global AI settings for Discord
DISCORD_AI_PROVIDER=openai  # or anthropic
DISCORD_AI_MODEL=gpt-4o     # or claude-3-5-sonnet-20241022
```

## Step 7: Test the Integration

### Manual Test
```bash
# Run the Discord scraper manually
npm run dev

# Then visit: http://localhost:3000/api/admin/scrape?source=Discord
# (Requires ADMIN_PASSWORD authentication)
```

### Check Logs
Look for output like:
```
Starting Discord scraper...
Fetching messages from #events...
  ✓ Fetched 5 messages from #events
  Processing message from @username in #events
    ✓ Extracted 1 events (1 total, 0 filtered out)
Discord scraper complete: {
  totalMessages: 5,
  totalSubmissions: 1,
  status: 'success'
}
```

## Step 8: Review Extracted Events

1. Go to `/admin/submissions` to see EventSubmissions created from Discord
2. Review and approve/reject each submission
3. Approved events will appear on the public events page

## Configuration Options

### Monitored Channels
Monitor multiple channels by adding more channel IDs:
```bash
DISCORD_MONITORED_CHANNELS='["1234", "5678", "9012"]'
```

Recommended channels to monitor:
- Dedicated #events channel
- General chat where events are posted
- Community announcements channel

### Scraper Interval
Controls how often the scraper checks for new messages:
```bash
DISCORD_SCRAPER_INTERVAL_HOURS=6  # Check every 6 hours (default)
DISCORD_SCRAPER_INTERVAL_HOURS=1  # Check every hour (more frequent)
DISCORD_SCRAPER_INTERVAL_HOURS=24 # Check once per day
```

### AI Provider
Override the global AI provider for Discord-specific extraction:
```bash
DISCORD_AI_PROVIDER=openai
DISCORD_AI_MODEL=gpt-4o  # Required for image processing
```

For best results with event posters, use:
- **OpenAI gpt-4o** (recommended for images)
- **Anthropic claude-3-5-sonnet-20241022** (also supports images)

## Monitoring & Debugging

### View Discord Messages Log
Access `/admin/discord-messages` (to be implemented in Phase 2) to see:
- All processed messages
- Extraction status (success/error/no_events)
- Number of events extracted per message
- Error messages for failed extractions

### View Scraper Logs
Access `/admin/scraper-logs` to see scraper run history:
- Timestamp of each run
- Success/error status
- Number of messages processed
- Number of event submissions created

### Common Issues

**Bot can't read messages:**
- Ensure "Message Content Intent" is enabled in Discord Developer Portal
- Check bot has "View Channels" and "Read Message History" permissions
- Verify bot is in the server and can see the monitored channels

**No events extracted:**
- Check that monitored channels have event-related content
- Verify AI API key is set (OPENAI_API_KEY or ANTHROPIC_API_KEY)
- Messages may be casual chat (AI returns empty array for non-events)

**API rate limits:**
- Discord API: 50 requests/second (unlikely to hit with periodic scraping)
- OpenAI API: Check your account tier limits
- Reduce DISCORD_SCRAPER_INTERVAL_HOURS if hitting limits

## Cost Estimation

### OpenAI API Costs (gpt-4o)
- Cost per message: ~$0.02-0.05 (varies with image count/size)
- Volume: 5-10 events/week ≈ 40 messages/month
- **Estimated monthly cost: $0.80 - $2.00**

### Discord Bot
- Free (no hosting required, bot runs during scraper cron)

## Security & Privacy

### Data Stored
- Discord message text content
- Discord usernames (not user IDs publicly)
- Message timestamps
- Attached image URLs

### Not Stored Publicly
- Discord user IDs remain internal
- Events posted publicly on Nyack Today don't include Discord author
- Only admins see Discord message source in admin panel

### Bot Permissions
- Bot has **read-only** access
- Cannot post, delete, or modify messages
- Cannot access channels not explicitly monitored

## Next Steps

After setup is complete:
1. Let the bot run for a few days to collect event posts
2. Review extraction accuracy in admin panel
3. Adjust monitored channels if needed
4. Tune AI prompts if extraction quality needs improvement (see `src/lib/ai/client.ts`)

## Support

For issues or questions:
- Check logs in `/admin/scraper-logs` and `/admin/discord-messages`
- Review Discord Developer Portal bot status
- Verify all environment variables are set correctly
- Open an issue on GitHub with relevant error messages
