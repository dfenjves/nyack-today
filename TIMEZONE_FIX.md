# Timezone Bug Fix

## Problem
When users submitted events with a time (e.g., 9PM), they would appear with the wrong time (e.g., 5PM) when displayed. This was a 4-hour difference indicating a timezone conversion issue.

## Root Cause
The frontend was creating datetime strings like `"2026-03-21T21:00"` (no timezone specified). When the backend parsed these strings using `new Date(data.startDate)`, JavaScript interpreted them as local time **on the server** (likely UTC), not the user's local time or the intended Eastern Time.

Since Nyack Today is specifically for Nyack, NY (Eastern Time), all events should be stored and displayed in Eastern Time.

## Solution
Created a new utility function `parseEasternTime()` in `src/lib/utils/timezone.ts` that:
1. Parses the datetime string components
2. Creates a proper UTC Date object that represents the time in Eastern timezone
3. Correctly handles Daylight Saving Time (DST) transitions

## Files Modified

### New File
- `src/lib/utils/timezone.ts` - Timezone parsing utility

### Updated Files
- `src/app/api/submit-event/route.ts` - User event submissions
- `src/app/api/admin/events/route.ts` - Admin event creation
- `src/app/api/admin/events/[id]/route.ts` - Admin event updates

### Test File
- `scripts/test-timezone-fix.ts` - Verification test

## Testing
Run the test to verify the fix:
```bash
npx tsx scripts/test-timezone-fix.ts
```

Expected output: `✅ TEST PASSED!`

## Example
- **User input:** March 21, 2026 at 9:00 PM
- **Stored as:** 2026-03-22T01:00:00.000Z (1 AM UTC next day)
- **Displayed as:** March 21, 2026 at 9:00 PM (Eastern Time)

The key is that the UTC storage correctly represents 9PM Eastern, so when displayed back to users in Eastern Time, it shows the correct 9PM time.
