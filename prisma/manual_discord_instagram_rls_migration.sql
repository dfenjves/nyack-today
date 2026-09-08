-- Enable RLS on DiscordMessage and InstagramPost (internal scraper data, same
-- deny-all pattern as ScraperLog: not exposed via Supabase's public API).

ALTER TABLE "DiscordMessage" ENABLE ROW LEVEL SECURITY;

CREATE POLICY discordmessage_select_policy ON "DiscordMessage"
  FOR SELECT TO public USING (false);

CREATE POLICY discordmessage_insert_policy ON "DiscordMessage"
  FOR INSERT TO public WITH CHECK (false);

CREATE POLICY discordmessage_update_policy ON "DiscordMessage"
  FOR UPDATE TO public USING (false) WITH CHECK (false);

CREATE POLICY discordmessage_delete_policy ON "DiscordMessage"
  FOR DELETE TO public USING (false);

ALTER TABLE "InstagramPost" ENABLE ROW LEVEL SECURITY;

CREATE POLICY instagrampost_select_policy ON "InstagramPost"
  FOR SELECT TO public USING (false);

CREATE POLICY instagrampost_insert_policy ON "InstagramPost"
  FOR INSERT TO public WITH CHECK (false);

CREATE POLICY instagrampost_update_policy ON "InstagramPost"
  FOR UPDATE TO public USING (false) WITH CHECK (false);

CREATE POLICY instagrampost_delete_policy ON "InstagramPost"
  FOR DELETE TO public USING (false);
