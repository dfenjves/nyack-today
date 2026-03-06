# Email Newsletter Scraper - Setup Guide

This guide walks you through setting up the automated email-based event ingestion system for Nyack Today.

## Overview

The email scraper monitors a dedicated Gmail account for event newsletters, uses AI (GPT-4/Claude) to extract event data, and automatically adds events to your database.

**Cost**: ~$0.40-$2/month for AI processing (based on email volume)

## Prerequisites

- Gmail account dedicated to receiving event newsletters
- OpenAI API key (or Anthropic API key as fallback)
- Google Cloud account (free tier is sufficient)

---

## Part 1: Create Dedicated Gmail Account

1. Create a new Gmail account specifically for event newsletters
   - Recommended format: `events@yourproject.com` or `newsletters@nyacktoday.com`
   - This keeps event emails separate from personal/work email

2. Sign up for newsletters from local venues:
   - Visit Nyack (visitnyack.org)
   - Nyack Chamber of Commerce
   - Individual venues (Levity Live, Elmwood Playhouse, etc.)
   - Community calendars

3. Note the email addresses that newsletters come from
   - You'll add these to the allowlist later

---

## Part 2: Set Up Google Cloud Project

### Step 1: Create Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name: "Nyack Today Email Scraper" (or similar)
4. Click "Create"

### Step 2: Enable Gmail API

1. In the Cloud Console, navigate to **APIs & Services > Library**
2. Search for "Gmail API"
3. Click "Gmail API" → "Enable"

### Step 3: Configure OAuth Consent Screen

1. Navigate to **APIs & Services > OAuth consent screen**
2. Select **External** user type → Click "Create"
3. Fill in required fields:
   - App name: "Nyack Today"
   - User support email: Your email
   - Developer contact: Your email
4. Click "Save and Continue"
5. **Scopes**: Click "Add or Remove Scopes"
   - Find and select: `https://www.googleapis.com/auth/gmail.modify`
   - This allows reading, labeling, and managing emails
   - Click "Update" → "Save and Continue"
6. **Test users**: Add your Gmail account email
   - This allows you to authorize the app during testing
   - Click "Add Users" → enter email → "Save and Continue"
7. Click "Back to Dashboard"

### Step 4: Create OAuth Credentials

1. Navigate to **APIs & Services > Credentials**
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: **Web application**
4. Name: "Nyack Today Email Scraper"
5. **Authorized redirect URIs**: Add these URLs:
   ```
   http://localhost:3000/api/admin/gmail/callback
   https://yourdomain.com/api/admin/gmail/callback
   ```
   (Replace `yourdomain.com` with your production domain)
6. Click "Create"
7. **Save the Client ID and Client Secret** - you'll need these next

---

## Part 3: Get OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to **API Keys** (left sidebar)
4. Click "Create new secret key"
5. Name: "Nyack Today Email Scraper"
6. Copy the API key (starts with `sk-...`)
7. **Add credits**: Go to **Settings > Billing** and add $5-10 to start

**Alternative**: Use Anthropic Claude instead
- Get API key from [Anthropic Console](https://console.anthropic.com/settings/keys)
- Note: Both providers work well; OpenAI has slightly better JSON formatting

---

## Part 4: Configure Environment Variables

Add these to your `.env.local` file:

```bash
# Gmail API OAuth
GMAIL_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GMAIL_CLIENT_SECRET="your-client-secret"
GMAIL_REDIRECT_URI="http://localhost:3000/api/admin/gmail/callback"

# Email Processing
EMAIL_SENDER_ALLOWLIST='["newsletter@visitnyack.org","events@nyackchamber.org"]'
EMAIL_MAX_AGE_DAYS="7"
EMAIL_MAX_PER_RUN="50"

# AI API Key
OPENAI_API_KEY="sk-your-api-key"

# Optional: AI Configuration (defaults shown)
AI_PROVIDER="openai"
AI_MODEL="gpt-4o"
AI_MAX_TOKENS="4096"
AI_TEMPERATURE="0.1"
```

**Update EMAIL_SENDER_ALLOWLIST** with actual sender emails from your newsletters.

---

## Part 5: Get Gmail Refresh Token

You need a refresh token to allow the app to access Gmail without manual login each time.

### Option A: Use OAuth Playground (Easiest)

1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Click the gear icon (⚙️) in top right
3. Check "Use your own OAuth credentials"
4. Enter your Client ID and Client Secret from Part 2
5. In the left panel, find **Gmail API v1**
6. Select: `https://www.googleapis.com/auth/gmail.modify`
7. Click "Authorize APIs"
8. Log in with your dedicated Gmail account
9. Click "Allow" to grant permissions
10. Click "Exchange authorization code for tokens"
11. Copy the **Refresh token** (long string starting with `1//...`)

Add to `.env.local`:
```bash
GMAIL_REFRESH_TOKEN="1//your-refresh-token"
```

### Option B: Use Admin Dashboard (After implementing OAuth endpoints)

1. Navigate to `/admin/gmail-setup` in your local app
2. Click "Authorize Gmail"
3. Log in with your dedicated Gmail account
4. Grant permissions
5. Copy the refresh token and add to `.env.local`

---

## Part 6: Test the Email Scraper

### 1. Forward a test email

Forward or send a sample event newsletter to your dedicated Gmail account.

### 2. Run the scraper manually

```bash
# Start development server
npm run dev

# In another terminal, trigger scraper
curl -X POST http://localhost:3000/api/scrape?source=email \
  -H "x-admin-password: your-admin-password"
```

### 3. Check the output

You should see console logs like:
```
Starting email newsletter scraper...
Email processor configuration: { allowedSenders: [...], maxAgeDays: 7, ... }
Found 1 unprocessed emails
Processing email: "Upcoming Events in Nyack" from newsletter@visitnyack.org
  ✓ Extracted 3 events from email (3 total, 0 filtered out)
Email scraper complete: { totalEmails: 1, totalEvents: 3, status: 'success' }
```

### 4. Verify events in database

```bash
# Open Prisma Studio
npx prisma studio

# Check Event table
# Filter by sourceName = "Email Newsletters"
```

You should see the extracted events with:
- `sourceName`: "Email Newsletters"
- `sourceUrl`: "gmail:message-id"
- Correctly parsed dates, venues, categories

### 5. Check Gmail labels

Log in to your dedicated Gmail account and verify:
- Processed emails have label: `nyack-today/processed`
- Failed emails have label: `nyack-today/error`

---

## Part 7: Add to Cron Schedule (Production)

Once testing is successful, add email scraper to your cron schedule.

### Vercel Cron (vercel.json)

```json
{
  "crons": [
    {
      "path": "/api/scrape",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

This runs all scrapers (including email) every 6 hours.

### Separate email scraper schedule

If you want email scraper to run more frequently:

```json
{
  "crons": [
    {
      "path": "/api/scrape",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/scrape?source=email",
      "schedule": "0 */2 * * *"
    }
  ]
}
```

This runs email scraper every 2 hours, all scrapers every 6 hours.

---

## Troubleshooting

### Error: "GMAIL_REFRESH_TOKEN not configured"

**Cause**: Refresh token not set in environment variables.

**Fix**: Complete Part 5 to get refresh token and add to `.env.local`.

---

### Error: "Failed to authenticate with Gmail API"

**Possible causes**:
1. Refresh token is invalid or expired
2. Gmail API not enabled in Google Cloud
3. OAuth consent screen not configured properly

**Fix**:
1. Generate a new refresh token (Part 5)
2. Verify Gmail API is enabled (Part 2, Step 2)
3. Ensure you added yourself as test user (Part 2, Step 3)

---

### Error: "EMAIL_SENDER_ALLOWLIST is empty"

**Cause**: No allowed senders configured.

**Fix**: Add sender emails to `EMAIL_SENDER_ALLOWLIST` in `.env.local`:
```bash
EMAIL_SENDER_ALLOWLIST='["newsletter@visitnyack.org","events@example.com"]'
```

---

### Error: "OPENAI_API_KEY not configured"

**Cause**: AI API key not set.

**Fix**: Get API key from Part 3 and add to `.env.local`.

---

### No events extracted from emails

**Possible causes**:
1. AI couldn't find events in email content
2. Events are in the past (filtered out)
3. Events are outside coverage area

**Debug steps**:
1. Check console logs for AI extraction details
2. Verify email contains event information
3. Try with a different newsletter format

---

### Events extracted but with wrong data

**Possible causes**:
1. AI misinterpreted email content
2. Email format is unusual

**Fix**:
1. Review extracted events in admin dashboard
2. Hide/edit incorrect events
3. Add sender-specific prompts (advanced - see `src/lib/ai/prompts.ts`)

---

### High AI API costs

**Optimization strategies**:
1. **Reduce email frequency**: Change `EMAIL_MAX_AGE_DAYS` to 3 instead of 7
2. **Use sender allowlist**: Only process known event newsletters
3. **Switch to cheaper model**: Change `AI_MODEL` to `gpt-4o-mini` (cheaper but less accurate)
4. **Limit emails per run**: Reduce `EMAIL_MAX_PER_RUN` to 25

**Cost monitoring**:
- Check [OpenAI Dashboard](https://platform.openai.com/usage) for usage
- Set up billing alerts in your account settings

---

## Monitoring

### Check scraper logs

```bash
# View recent scraper runs
curl http://localhost:3000/api/admin/scrapers \
  -H "x-admin-password: your-admin-password" \
  | jq '.logs[] | select(.sourceName == "Email Newsletters")'
```

### Email processing metrics

After each run, check:
- Number of emails processed
- Number of events extracted
- Success vs error rate
- Processing time

### Gmail quota limits

Google allows:
- **1 billion quota units per day** (reading messages uses ~5-10 units each)
- For typical usage (100 emails/day), you won't hit limits

If you do:
- Reduce `EMAIL_MAX_PER_RUN`
- Increase time between scraper runs

---

## Advanced Configuration

### Sender-Specific Prompts

For newsletters with unique formats, you can create custom prompts:

1. Edit `src/lib/ai/prompts.ts`
2. Add sender-specific logic in `buildUserPrompt()`
3. Example:
```typescript
export function buildUserPrompt(params: { ... }) {
  const from = params.from.toLowerCase();

  // Custom prompt for specific sender
  if (from.includes('levitylive.com')) {
    return `This is a comedy venue newsletter. Extract comedy show events...\n\n${params.body}`;
  }

  // Default prompt
  return `Email Subject: ${params.subject}...\n\n${params.body}`;
}
```

### Image Extraction

Currently, images are extracted if the AI finds `imageUrl` in the email HTML.

To improve image extraction:
1. Modify `src/lib/ai/prompts.ts` to emphasize image extraction
2. Post-process images to upload to Supabase Storage (see plan for Phase 2 enhancements)

### Multi-Account Support

To monitor multiple Gmail accounts:
1. Create separate `.env` variables for each account (e.g., `GMAIL_REFRESH_TOKEN_1`, `GMAIL_REFRESH_TOKEN_2`)
2. Modify `src/lib/scrapers/email.ts` to support multiple configurations
3. Run separate scraper instances

---

## Next Steps

Once the email scraper is working:

1. **Subscribe to more newsletters**: Expand your event sources
2. **Monitor accuracy**: Review extracted events weekly, adjust prompts if needed
3. **Set up notifications**: Configure Discord/Slack to alert on scraper errors
4. **Implement OAuth admin UI**: Build the admin dashboard for easier setup (Part 4, pending tasks)

---

## Security Best Practices

1. **Never commit credentials**: Keep `.env.local` in `.gitignore`
2. **Use dedicated Gmail account**: Don't use personal email
3. **Rotate tokens periodically**: Regenerate refresh tokens every 6 months
4. **Monitor API usage**: Set billing alerts in Anthropic/OpenAI
5. **Limit sender allowlist**: Only add trusted newsletter sources

---

## FAQ

**Q: Can I use my personal Gmail instead of a dedicated account?**

A: Not recommended. Event newsletters will clutter your inbox, and the scraper will process all emails from allowed senders.

---

**Q: How accurate is the AI extraction?**

A: Typically 90%+ accuracy for well-formatted newsletters. You can review and edit events in the admin dashboard.

---

**Q: What if the AI extracts duplicate events?**

A: The existing deduplication system (via `sourceHash`) prevents duplicates. If the same event is in an email and a website scraper, the first source wins.

---

**Q: Can I process past emails?**

A: Yes, change `EMAIL_MAX_AGE_DAYS` to a higher value (e.g., 30). Note: This will increase AI API costs.

---

**Q: How do I disable the email scraper?**

A: Remove `emailScraper` from the `scrapers` array in `src/lib/scrapers/index.ts`. No events will be processed, and no API calls will be made.

---

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review console logs for error details
3. Verify all environment variables are set correctly
4. Test with a simple newsletter first

For additional help, see the main project documentation or contact the development team.
