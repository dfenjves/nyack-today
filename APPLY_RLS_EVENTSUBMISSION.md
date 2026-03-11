# Apply RLS to EventSubmission and _prisma_migrations Tables

This addresses the Supabase security linter warnings for the two remaining tables without RLS protection.

## Step 1: Run This SQL in Supabase

1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy and paste the SQL below
3. Click **Run**

```sql
-- Enable Row Level Security on EventSubmission and _prisma_migrations tables

-- Enable RLS on EventSubmission table
ALTER TABLE "EventSubmission" ENABLE ROW LEVEL SECURITY;

-- Enable RLS on _prisma_migrations table
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- EventSubmission table policies
-- Allow public to submit events (INSERT)
CREATE POLICY "eventsubmission_insert_policy"
  ON "EventSubmission"
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Deny public read access (admin only via service role)
CREATE POLICY "eventsubmission_select_policy"
  ON "EventSubmission"
  FOR SELECT
  TO public
  USING (false);

-- Deny public updates (admin only via service role)
CREATE POLICY "eventsubmission_update_policy"
  ON "EventSubmission"
  FOR UPDATE
  TO public
  USING (false)
  WITH CHECK (false);

-- Deny public deletes (admin only via service role)
CREATE POLICY "eventsubmission_delete_policy"
  ON "EventSubmission"
  FOR DELETE
  TO public
  USING (false);

-- _prisma_migrations table policies
-- Deny all public access (internal use only)
CREATE POLICY "prisma_migrations_select_policy"
  ON "_prisma_migrations"
  FOR SELECT
  TO public
  USING (false);

CREATE POLICY "prisma_migrations_insert_policy"
  ON "_prisma_migrations"
  FOR INSERT
  TO public
  WITH CHECK (false);

CREATE POLICY "prisma_migrations_update_policy"
  ON "_prisma_migrations"
  FOR UPDATE
  TO public
  USING (false)
  WITH CHECK (false);

CREATE POLICY "prisma_migrations_delete_policy"
  ON "_prisma_migrations"
  FOR DELETE
  TO public
  USING (false);
```

## Step 2: Verify It Works

### Check RLS is enabled:

Run this in the Supabase SQL Editor:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('EventSubmission', '_prisma_migrations')
ORDER BY tablename;
```

Should show `rowsecurity = t` for both tables.

### Test event submission still works:

```bash
npm run dev
# Visit http://localhost:3000 and try submitting an event
```

## What These Policies Do

### EventSubmission Table
- ✅ Public can INSERT (submit events via the public form)
- ❌ Public cannot SELECT/UPDATE/DELETE (only admin via service role can view/manage submissions)

This protects submitter email addresses and prevents unauthorized access to pending submissions.

### _prisma_migrations Table
- ❌ Public cannot access at all (internal Prisma table)

This prevents exposure of database schema change history.

## Important Notes

- Your Next.js app uses the `DIRECT_URL` with service role credentials, which bypasses RLS
- This means your admin API routes can still read, update, and delete event submissions
- Only direct PostgREST API access is restricted
- The public event submission form will continue to work (INSERT is allowed)

## Security Benefits

- ✅ Protects submitter email addresses from unauthorized access
- ✅ Prevents unauthorized viewing/editing of pending event submissions
- ✅ Prevents exposure of database migration history
- ✅ Resolves remaining Supabase security linter warnings
- ✅ Maintains existing app functionality
