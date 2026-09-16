/**
 * Instagram handle resolution.
 *
 * The list of accounts the Instagram scraper monitors comes from two places:
 *  - the `InstagramHandle` table, managed at /admin/instagram (source of truth)
 *  - the legacy `INSTAGRAM_HANDLES` env var, still merged in so existing
 *    deployments keep working until the admin page has imported it
 *
 * The union is deduplicated case-insensitively. A handle that is disabled in
 * the admin page but still present in the env var keeps being scraped; the
 * admin page shows an "env" badge for those so the reason is visible.
 */

import { prisma } from '@/lib/db';

export interface ResolvedInstagramHandles {
  /** Handles to scrape, lowercase, no leading @, deduplicated. */
  handles: string[];
  /** Venue hint per handle (lowercase key), for the AI when captions name no venue. */
  venueHints: Record<string, string>;
  /** Counts, for logging. */
  fromDb: number;
  fromEnv: number;
}

/** Normalizes user or env input into the stored form: lowercase, no @, trimmed. */
export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@/, '').replace(/\/+$/, '').toLowerCase();
}

/** Instagram usernames: 1–30 chars of letters, digits, periods, underscores. */
export function isValidHandle(handle: string): boolean {
  return /^[a-z0-9._]{1,30}$/.test(handle);
}

/** Parses the legacy INSTAGRAM_HANDLES env var. */
export function getEnvHandles(): string[] {
  const seen = new Set<string>();
  return (process.env.INSTAGRAM_HANDLES || '')
    .split(',')
    .map(normalizeHandle)
    .filter((h) => h.length > 0 && !seen.has(h) && seen.add(h));
}

export async function resolveInstagramHandles(): Promise<ResolvedInstagramHandles> {
  const rows = await prisma.instagramHandle.findMany({
    where: { enabled: true },
    select: { handle: true, venueName: true },
    orderBy: { handle: 'asc' },
  });

  const venueHints: Record<string, string> = {};
  const merged = new Set<string>();

  for (const row of rows) {
    const handle = normalizeHandle(row.handle);
    merged.add(handle);
    if (row.venueName) venueHints[handle] = row.venueName;
  }

  const envHandles = getEnvHandles();
  for (const handle of envHandles) merged.add(handle);

  return {
    handles: Array.from(merged).sort(),
    venueHints,
    fromDb: rows.length,
    fromEnv: envHandles.length,
  };
}
