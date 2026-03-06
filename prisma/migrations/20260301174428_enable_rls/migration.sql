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
