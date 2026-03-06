# Apply RLS Migration - Quick Reference

## Step 1: Run This SQL in Supabase

1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy and paste the SQL below
3. Click **Run**

```sql
-- Enable Row Level Security on all tables
ALTER TABLE "Event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Activity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScraperLog" ENABLE ROW LEVEL SECURITY;

-- Event table policies
-- Allow public read access to non-hidden events
CREATE POLICY "event_select_policy"
  ON "Event"
  FOR SELECT
  TO public
  USING (true);

-- Deny all insert, update, delete via PostgREST
-- (these operations should only happen through Next.js API with service role)
CREATE POLICY "event_insert_policy"
  ON "Event"
  FOR INSERT
  TO public
  WITH CHECK (false);

CREATE POLICY "event_update_policy"
  ON "Event"
  FOR UPDATE
  TO public
  USING (false)
  WITH CHECK (false);

CREATE POLICY "event_delete_policy"
  ON "Event"
  FOR DELETE
  TO public
  USING (false);

-- Activity table policies
-- Allow public read access
CREATE POLICY "activity_select_policy"
  ON "Activity"
  FOR SELECT
  TO public
  USING (true);

-- Deny all write operations
CREATE POLICY "activity_insert_policy"
  ON "Activity"
  FOR INSERT
  TO public
  WITH CHECK (false);

CREATE POLICY "activity_update_policy"
  ON "Activity"
  FOR UPDATE
  TO public
  USING (false)
  WITH CHECK (false);

CREATE POLICY "activity_delete_policy"
  ON "Activity"
  FOR DELETE
  TO public
  USING (false);

-- ScraperLog table policies
-- Deny all public access (internal use only)
CREATE POLICY "scraperlog_select_policy"
  ON "ScraperLog"
  FOR SELECT
  TO public
  USING (false);

CREATE POLICY "scraperlog_insert_policy"
  ON "ScraperLog"
  FOR INSERT
  TO public
  WITH CHECK (false);

CREATE POLICY "scraperlog_update_policy"
  ON "ScraperLog"
  FOR UPDATE
  TO public
  USING (false)
  WITH CHECK (false);

CREATE POLICY "scraperlog_delete_policy"
  ON "ScraperLog"
  FOR DELETE
  TO public
  USING (false);
```

## Step 2: Update Your .env.local

Your app needs to use the **service role** connection to bypass RLS for write operations.

Get your service role password from Supabase:
- **Option A**: Dashboard → Settings → Database → Connection string → **Session mode** (copy the password from the URL)
- **Option B**: Dashboard → Settings → API → Copy the `service_role` key (JWT token starting with `eyJ...`)

Then update `.env.local`:

```bash
# Use service role to bypass RLS
DIRECT_URL="postgresql://postgres.[project-ref]:[service-role-password]@aws-0-[region].pooler.supabase.com:5432/postgres"
```

## Step 3: Mark Migration as Applied

```bash
npx prisma migrate resolve --applied 20260301174428_enable_rls
```

## Step 4: Verify It Works

### Check RLS is enabled:
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('Event', 'Activity', 'ScraperLog');
```

Should show `rowsecurity = t` for all 3 tables.

### Test your app:
```bash
npm run dev
curl http://localhost:3000/api/events
```

Should return events successfully.

---

**See `RLS_MIGRATION_GUIDE.md` for detailed documentation and troubleshooting.**
