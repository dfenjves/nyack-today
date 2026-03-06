# Row Level Security (RLS) Migration Guide

## Overview

This migration enables Row Level Security on your Supabase database to fix the security vulnerability where tables were publicly accessible via Supabase's PostgREST API without any access controls.

## What Changed

### RLS Policies Created

1. **Event Table**
   - ✅ Public can SELECT (read) events
   - ❌ Public cannot INSERT, UPDATE, or DELETE events

2. **Activity Table**
   - ✅ Public can SELECT (read) activities
   - ❌ Public cannot INSERT, UPDATE, or DELETE activities

3. **ScraperLog Table**
   - ❌ Public cannot access (internal use only)

### How This Protects You

- Direct database access via Supabase's PostgREST API is now restricted
- Public users can only read events/activities (which is appropriate for a public calendar)
- All write operations must go through your Next.js API routes (which is already how your app works)
- Your Next.js app uses a privileged connection that bypasses RLS

## Important: Service Role Configuration

Your Next.js application needs to bypass RLS to perform write operations. This is configured via the `DIRECT_URL` environment variable.

### Update Your DIRECT_URL

1. Go to your Supabase Dashboard
2. Navigate to: **Settings > Database > Connection string**
3. Select **Session mode** (not Transaction mode)
4. Copy the connection string - it will include your service role password
5. Update your `.env.local` file:

```bash
# Your DIRECT_URL should use the service role to bypass RLS
DIRECT_URL="postgresql://postgres.[project-ref]:[service-role-password]@aws-0-[region].pooler.supabase.com:5432/postgres"
```

**Note**: The service role password is different from your database password. It's a JWT token that starts with "eyJ...".

Alternatively, you can find the service role key at:
**Settings > API > Project API keys > service_role**

Then construct the URL as:
```bash
DIRECT_URL="postgresql://postgres:[service_role_key]@aws-0-[region].pooler.supabase.com:5432/postgres"
```

## Migration Steps

### 1. Backup (Recommended)

```bash
# Create a backup before applying (optional but recommended)
pg_dump $DATABASE_URL > backup_before_rls.sql
```

### 2. Apply the Migration

```bash
# Apply the RLS migration
npx prisma migrate deploy
```

### 3. Verify the Migration

Check that RLS is enabled:

```sql
-- Run in Supabase SQL Editor
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('Event', 'Activity', 'ScraperLog');
```

Expected output:
```
tablename   | rowsecurity
------------|------------
Event       | t
Activity    | t
ScraperLog  | t
```

### 4. Test Your Application

1. **Test public event viewing:**
   ```bash
   curl http://localhost:3000/api/events
   ```
   Should return events successfully.

2. **Test admin operations:**
   - Log in to admin panel
   - Try creating/editing/deleting an event
   - Should work normally

3. **Test direct PostgREST access (should be read-only):**
   ```bash
   # This should work (public read)
   curl 'https://[project-ref].supabase.co/rest/v1/Event?select=*' \
     -H "apikey: [your-anon-key]"

   # This should fail (public cannot insert)
   curl -X POST 'https://[project-ref].supabase.co/rest/v1/Event' \
     -H "apikey: [your-anon-key]" \
     -H "Content-Type: application/json" \
     -d '{"title":"test"}'
   ```

## Troubleshooting

### Issue: App cannot create/update events

**Cause**: Your `DIRECT_URL` is not using the service role connection.

**Fix**: Update your `.env.local` with the service role connection string (see "Update Your DIRECT_URL" section above).

### Issue: Public users cannot view events

**Cause**: The SELECT policy might not be applied correctly.

**Fix**: Verify policies exist:
```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'Event';
```

### Issue: Migration fails

**Cause**: Existing connections might be holding locks.

**Fix**:
1. Close all connections to the database
2. Retry the migration
3. Or apply manually via Supabase SQL Editor

## Manual Rollback (If Needed)

If you need to disable RLS:

```sql
-- Disable RLS on all tables (not recommended for production)
ALTER TABLE "Event" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Activity" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "ScraperLog" DISABLE ROW LEVEL SECURITY;

-- Drop all policies
DROP POLICY IF EXISTS "event_select_policy" ON "Event";
DROP POLICY IF EXISTS "event_insert_policy" ON "Event";
DROP POLICY IF EXISTS "event_update_policy" ON "Event";
DROP POLICY IF EXISTS "event_delete_policy" ON "Event";
-- ... (repeat for Activity and ScraperLog)
```

## Security Benefits

- ✅ Prevents unauthorized direct database writes
- ✅ Limits direct database reads to safe public data
- ✅ Protects internal ScraperLog data from public access
- ✅ Maintains your existing Next.js API-based authorization
- ✅ Resolves Supabase security linter warnings

## Questions?

If you encounter any issues, check:
1. Supabase logs: Dashboard > Logs
2. Next.js logs: Check your console for Prisma errors
3. Verify your DIRECT_URL is correctly configured
