/**
 * Instagram Client
 *
 * Fetches recent posts from monitored Instagram handles via Apify's
 * Instagram Scraper actor (https://apify.com/apify/instagram-scraper).
 *
 * We call Apify's REST API directly with fetch (no SDK) to avoid adding a
 * bundled dependency — Apify handles Instagram's IP rotation and anti-bot
 * measures on its side.
 */

import { InstagramConfig, InstagramPostData } from './types';

const APIFY_ACTOR = 'apify~instagram-scraper';
const APIFY_ENDPOINT = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items`;

/**
 * Gets Instagram configuration from environment variables
 */
export function getInstagramConfig(): InstagramConfig {
  const seen = new Set<string>();
  const handles = (process.env.INSTAGRAM_HANDLES || '')
    .split(',')
    .map((h) => h.trim().replace(/^@/, ''))
    .filter((h) => h.length > 0)
    .filter((h) => {
      const key = h.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const apifyToken = process.env.APIFY_API_TOKEN || '';
  const scraperEnabled = process.env.INSTAGRAM_SCRAPER_ENABLED === 'true';
  const intervalHours = parseInt(
    process.env.INSTAGRAM_SCRAPER_INTERVAL_HOURS || '24',
    10
  );
  const postsPerHandle = parseInt(
    process.env.INSTAGRAM_POSTS_PER_HANDLE || '10',
    10
  );
  const aiProvider = process.env.INSTAGRAM_AI_PROVIDER;
  const aiModel = process.env.INSTAGRAM_AI_MODEL;

  return {
    handles,
    apifyToken,
    scraperEnabled,
    intervalHours,
    postsPerHandle,
    aiProvider,
    aiModel,
  };
}

/**
 * Apify's post output has varied field names across actor versions, so we read
 * defensively rather than binding to one exact shape.
 */
interface ApifyPost {
  shortCode?: string;
  shortcode?: string;
  caption?: string;
  timestamp?: string;
  takenAtTimestamp?: number;
  displayUrl?: string;
  images?: string[];
  url?: string;
  ownerUsername?: string;
  type?: string;
  error?: string;
}

/**
 * Normalizes a raw Apify post into our InstagramPostData shape.
 * Returns null if the post is missing the fields we require.
 */
function normalizePost(raw: ApifyPost): InstagramPostData | null {
  const shortcode = raw.shortCode || raw.shortcode;
  if (!shortcode) return null;

  // Determine post timestamp (ISO string or unix seconds)
  let postedAt: Date;
  if (raw.timestamp) {
    postedAt = new Date(raw.timestamp);
  } else if (raw.takenAtTimestamp) {
    postedAt = new Date(raw.takenAtTimestamp * 1000);
  } else {
    return null;
  }
  if (isNaN(postedAt.getTime())) return null;

  // Collect image URLs: displayUrl plus any carousel images, de-duplicated
  const imageUrls = Array.from(
    new Set(
      [raw.displayUrl, ...(raw.images || [])].filter(
        (u): u is string => typeof u === 'string' && u.length > 0
      )
    )
  );

  const handle = raw.ownerUsername || '';
  const url = raw.url || `https://www.instagram.com/p/${shortcode}/`;

  return {
    shortcode,
    handle,
    caption: raw.caption || '',
    imageUrls,
    postedAt,
    url,
  };
}

/**
 * Fetches recent posts for the given handles via Apify.
 *
 * @param handles - Instagram usernames (no @)
 * @param config - Instagram config (for token, interval, posts-per-handle)
 * @returns Normalized posts newer than `intervalHours`, across all handles
 */
export async function fetchRecentPosts(
  handles: string[],
  config: InstagramConfig
): Promise<InstagramPostData[]> {
  if (handles.length === 0) return [];
  if (!config.apifyToken) {
    throw new Error('APIFY_API_TOKEN not set in environment variables');
  }

  const directUrls = handles.map(
    (h) => `https://www.instagram.com/${h}/`
  );

  const input = {
    directUrls,
    resultsType: 'posts',
    resultsLimit: config.postsPerHandle,
    addParentData: false,
  };

  const response = await fetch(
    `${APIFY_ENDPOINT}?token=${encodeURIComponent(config.apifyToken)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Apify request failed (${response.status} ${response.statusText}): ${body.slice(0, 300)}`
    );
  }

  const items = (await response.json()) as ApifyPost[];
  if (!Array.isArray(items)) {
    throw new Error('Unexpected Apify response: expected an array of posts');
  }

  const cutoff = new Date(Date.now() - config.intervalHours * 60 * 60 * 1000);

  const posts: InstagramPostData[] = [];
  for (const raw of items) {
    // Apify emits an error item when a profile can't be scraped — skip it
    if (raw.error) {
      console.warn(`Apify returned an error item: ${raw.error}`);
      continue;
    }

    const post = normalizePost(raw);
    if (!post) continue;

    // Only keep recent posts so we don't re-run extraction on old content.
    // (Dedup via InstagramPost also protects us, but this saves AI calls.)
    if (post.postedAt < cutoff) continue;

    posts.push(post);
  }

  return posts;
}
