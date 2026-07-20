/**
 * Instagram Post Processing Pipeline
 *
 * Orchestrates the flow: Instagram (via Apify) → AI extraction → EventSubmission
 * creation. Mirrors the Discord pipeline (src/lib/discord/processor.ts).
 *
 * Extracted events land in the EventSubmission review queue (status PENDING) so
 * an admin approves them before they reach the live feed — Instagram captions
 * are fuzzy enough that a human check is worth it.
 */

import { prisma } from '@/lib/db';
import { put } from '@vercel/blob';
import { extractEventsFromInstagram } from '../ai/client';
import { ExtractedEvent } from '../ai/types';
import { getInstagramConfig, fetchRecentPosts } from './client';
import { InstagramPostData, ProcessedInstagramPost, ProcessingStatus } from './types';
import {
  isInCoverageArea,
  parsePrice,
  guessFamilyFriendly,
} from '../scrapers/utils';
import { guessCategory } from '../utils/categories';

/**
 * Known venue name per Instagram handle. Used as a venue hint for the AI when a
 * post's caption doesn't name a specific venue (the account usually IS the
 * venue). Keys are lowercase handles without the leading @.
 *
 * Extend this as handles are added to INSTAGRAM_HANDLES.
 */
const HANDLE_VENUE_MAP: Record<string, string> = {
  casaofnyack: 'Casa Del Sol',
  hotelnyack: 'Hotel Nyack',
  'prohibition.river': 'Prohibition River',
  edwardhopperhouse: 'Edward Hopper House Museum & Study Center',
  nyackboatclub: 'Nyack Boat Club',
  bigredbooks: 'Big Red Books',
};

function venueHintFor(handle: string): string | null {
  return HANDLE_VENUE_MAP[handle.toLowerCase()] || null;
}

// A browser-like User-Agent — Instagram's CDN is fine serving to normal
// clients but rejects some server-side fetchers (notably OpenAI's image
// downloader, which is why we fetch images ourselves and inline them).
const IMAGE_FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  Referer: 'https://www.instagram.com/',
};

/**
 * Fetches an Instagram image and returns it as a base64 `data:` URL so it can be
 * sent inline to the vision model. Instagram's CDN rejects OpenAI's downloader,
 * so we cannot hand the model the raw URL. Returns null on failure.
 */
async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { headers: IMAGE_FETCH_HEADERS });
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) return null;

    const base64 = Buffer.from(await response.arrayBuffer()).toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

/**
 * Instagram CDN URLs are signed and expire, so re-host any image we want to
 * keep on Vercel Blob for permanent storage.
 */
async function uploadInstagramImageToBlob(
  instagramUrl: string
): Promise<string | null> {
  try {
    const response = await fetch(instagramUrl, { headers: IMAGE_FETCH_HEADERS });
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    const ext = contentType.split('/')[1]?.split(';')[0] || 'jpg';
    const filename = `instagram-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const blob = await put(filename, buffer, { access: 'public', contentType });
    return blob.url;
  } catch {
    return null;
  }
}

/**
 * Converts an AI-extracted event into a PENDING EventSubmission record.
 * Returns the submission id, or null if the event was filtered out.
 */
async function createEventSubmission(
  extracted: ExtractedEvent,
  post: InstagramPostData
): Promise<string | null> {
  try {
    // Parse dates
    const startDate = new Date(extracted.startDate);
    if (isNaN(startDate.getTime())) {
      console.warn(`Invalid start date for event: ${extracted.title}`);
      return null;
    }

    // Skip past events
    if (startDate < new Date()) {
      return null;
    }

    let endDate: Date | null = null;
    if (extracted.endDate) {
      endDate = new Date(extracted.endDate);
      if (isNaN(endDate.getTime())) {
        endDate = null;
      }
    }

    // These handles are all known Nyack-area venues, so fall back to the venue
    // map when the AI omits the venue, and to Nyack when it omits/mis-fills the
    // city — otherwise a legitimate event gets dropped by the coverage check.
    const knownVenue = venueHintFor(post.handle);
    const venue = extracted.venue || knownVenue || '';
    let city = extracted.city || '';
    if ((!city || !isInCoverageArea(city)) && knownVenue) {
      city = 'Nyack';
    }

    // Validate required fields
    if (!extracted.title || !venue || !city) {
      console.warn('Event missing required fields:', extracted);
      return null;
    }

    // Skip if not in coverage area
    if (!isInCoverageArea(city)) {
      return null;
    }

    const { price, isFree } = parsePrice(extracted.price);
    const category = guessCategory(extracted.title, extracted.description);
    const isFamilyFriendly = guessFamilyFriendly(
      extracted.title,
      extracted.description
    );

    // Always link back to the source post so admins can verify.
    const sourceUrl = post.url;

    // Re-host the post's first image to Blob for permanent storage (the AI is
    // given the image inline and no longer returns an imageUrl of its own).
    const imageUrl = post.imageUrls[0]
      ? await uploadInstagramImageToBlob(post.imageUrls[0])
      : null;

    const submission = await prisma.eventSubmission.create({
      data: {
        title: extracted.title,
        description: extracted.description ?? null,
        startDate,
        endDate,
        venue,
        address: extracted.address ?? null,
        city,
        category,
        price,
        isFree,
        isFamilyFriendly,
        sourceName: 'Instagram',
        sourceUrl,
        imageUrl,
        submitterEmail: `instagram-${post.handle || 'unknown'}@nyack.today`,
        status: 'PENDING',
      },
    });

    return submission.id;
  } catch (error) {
    console.error('Error creating event submission:', error);
    return null;
  }
}

/**
 * Processes a single Instagram post: dedup, AI extraction, submission creation,
 * and recording the InstagramPost row.
 */
async function processInstagramPost(
  post: InstagramPostData
): Promise<ProcessedInstagramPost> {
  try {
    // Skip posts we've already processed
    const existing = await prisma.instagramPost.findUnique({
      where: { shortcode: post.shortcode },
    });

    if (existing) {
      console.log(`  ⤳ Post ${post.shortcode} already processed, skipping`);
      return {
        shortcode: post.shortcode,
        handle: post.handle,
        status: 'no_events',
        eventsExtracted: 0,
        submissionIds: [],
      };
    }

    console.log(`  Processing post ${post.shortcode} from @${post.handle}`);

    // Fetch the post images ourselves and inline them as data URLs — Instagram's
    // CDN rejects the vision provider's downloader. Cap the count to keep the
    // payload/cost bounded (event flyers are almost always the first image).
    const MAX_IMAGES = 3;
    const dataUrls = (
      await Promise.all(
        post.imageUrls.slice(0, MAX_IMAGES).map(fetchImageAsDataUrl)
      )
    ).filter((u): u is string => u !== null);

    // Extract events using AI (caption + inlined images)
    const aiResponse = await extractEventsFromInstagram({
      caption: post.caption,
      handle: post.handle,
      postedAt: post.postedAt.toISOString(),
      venueHint: venueHintFor(post.handle),
      imageUrls: dataUrls,
    });

    // Create EventSubmission records for extracted events
    const submissionIds: string[] = [];
    for (const extracted of aiResponse.events) {
      const submissionId = await createEventSubmission(extracted, post);
      if (submissionId) {
        submissionIds.push(submissionId);
      }
    }

    const status: ProcessingStatus =
      submissionIds.length > 0
        ? 'success'
        : aiResponse.events.length > 0
          ? 'filtered' // AI found an event but it was dropped (past/out-of-area)
          : 'no_events';

    // Record the processed post
    await prisma.instagramPost.create({
      data: {
        shortcode: post.shortcode,
        handle: post.handle,
        caption: post.caption,
        imageUrls: post.imageUrls,
        postedAt: post.postedAt,
        status,
        eventsExtracted: submissionIds.length,
        errorMessage: null,
      },
    });

    console.log(
      `    ✓ Extracted ${submissionIds.length} events (${aiResponse.events.length} total, ${aiResponse.events.length - submissionIds.length} filtered out)`
    );

    return {
      shortcode: post.shortcode,
      handle: post.handle,
      status,
      eventsExtracted: submissionIds.length,
      submissionIds,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    console.error(`    ✗ Error processing post ${post.shortcode}:`, errorMessage);

    // Record the post with error status (so we don't retry it forever)
    await prisma.instagramPost.create({
      data: {
        shortcode: post.shortcode,
        handle: post.handle,
        caption: post.caption,
        imageUrls: post.imageUrls,
        postedAt: post.postedAt,
        status: 'error',
        eventsExtracted: 0,
        errorMessage,
      },
    }).catch(() => {
      // If even the record write fails (e.g. duplicate shortcode race), ignore.
    });

    return {
      shortcode: post.shortcode,
      handle: post.handle,
      status: 'error',
      eventsExtracted: 0,
      submissionIds: [],
      errorMessage,
    };
  }
}

/**
 * Fetches recent posts from monitored Instagram handles and creates
 * EventSubmission records. Main entry point for the Instagram pipeline.
 */
export async function processInstagramPosts(): Promise<{
  processedPosts: ProcessedInstagramPost[];
  totalSubmissions: number;
  successCount: number;
  errorCount: number;
}> {
  const config = getInstagramConfig();

  console.log('Instagram processor configuration:', {
    handles: config.handles,
    intervalHours: config.intervalHours,
    postsPerHandle: config.postsPerHandle,
  });

  if (config.handles.length === 0) {
    console.warn('INSTAGRAM_HANDLES is empty. No posts will be processed.');
    return {
      processedPosts: [],
      totalSubmissions: 0,
      successCount: 0,
      errorCount: 0,
    };
  }

  const posts = await fetchRecentPosts(config.handles, config);

  console.log(`Found ${posts.length} recent Instagram posts`);

  if (posts.length === 0) {
    return {
      processedPosts: [],
      totalSubmissions: 0,
      successCount: 0,
      errorCount: 0,
    };
  }

  const processedPosts: ProcessedInstagramPost[] = [];
  let successCount = 0;
  let errorCount = 0;

  for (const post of posts) {
    const result = await processInstagramPost(post);
    processedPosts.push(result);

    if (result.status === 'success') {
      successCount++;
    } else if (result.status === 'error') {
      errorCount++;
    }
  }

  const totalSubmissions = processedPosts.reduce(
    (sum, p) => sum + p.eventsExtracted,
    0
  );

  console.log('Instagram processing complete:', {
    totalPosts: posts.length,
    successCount,
    errorCount,
    totalSubmissions,
  });

  return {
    processedPosts,
    totalSubmissions,
    successCount,
    errorCount,
  };
}
