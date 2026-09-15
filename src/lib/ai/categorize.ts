/**
 * AI Event Categorizer
 *
 * Classifies events into the 11 `Category` values (and guesses
 * family-friendliness) using the same AI provider plumbing as
 * `src/lib/ai/client.ts`.
 *
 * Design notes:
 * - Runs on every newly scraped event, so it uses a cheap model by default
 *   (`AI_CATEGORIZE_MODEL`, falling back to gpt-4o-mini / claude-3-5-haiku).
 * - Batches up to 20 events per API call.
 * - Caches by content hash in-memory for the process lifetime, so re-scraping
 *   the same events within a run/process is free.
 * - Never throws. Any failure falls back to `guessCategory()` with
 *   `confidence: 'low'`.
 */

import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { Category } from '@prisma/client';
import { guessCategory } from '@/lib/utils/categories';
import { AIProvider } from './types';
import type { ScrapedEvent } from '@/lib/scrapers/types';

export interface CategorizeInput {
  title: string;
  description?: string | null;
  venue?: string | null;
  sourceName?: string | null;
}

export interface CategorizeResult {
  category: Category;
  isFamilyFriendly: boolean | null; // null = model wasn't confident
  confidence: 'high' | 'medium' | 'low';
}

export interface CategorizeStats {
  /** Number of events classified (including cache hits) */
  total: number;
  /** Number of AI API calls actually made */
  apiCalls: number;
  /** Number of events answered from the in-memory cache */
  cached: number;
}

/** Events per AI request */
export const CATEGORIZE_BATCH_SIZE = 20;

/** Valid category names, for validating model output */
const VALID_CATEGORIES = new Set<string>(Object.values(Category));

/**
 * Cheap defaults per provider. This runs on every scraped event, so we do not
 * inherit `AI_MODEL` (gpt-4o) from the extraction path.
 */
const CHEAP_MODELS: Record<AIProvider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-20241022',
};

interface CategorizeConfig {
  provider: AIProvider;
  model: string;
  maxTokens: number;
  temperature: number;
}

function getCategorizeConfig(): CategorizeConfig {
  const provider = (process.env.AI_PROVIDER || 'openai') as AIProvider;
  const model =
    process.env.AI_CATEGORIZE_MODEL ||
    CHEAP_MODELS[provider] ||
    CHEAP_MODELS.openai;

  return {
    provider,
    model,
    // ~60 tokens per event of JSON, plus slack
    maxTokens: 2048,
    temperature: 0,
  };
}

/** In-memory cache for the process lifetime. No DB cache table (by design). */
const categorizeCache = new Map<string, CategorizeResult>();

/** sha1 of title + venue + first 200 chars of description */
export function categorizeCacheKey(input: CategorizeInput): string {
  const parts = [
    input.title || '',
    input.venue || '',
    (input.description || '').slice(0, 200),
  ].join('|');
  return crypto.createHash('sha1').update(parts).digest('hex');
}

/** Test/maintenance hook: clear the in-memory cache */
export function clearCategorizeCache(): void {
  categorizeCache.clear();
}

export const CATEGORIZE_SYSTEM_PROMPT = `You categorize local events for Nyack, NY (Rockland County, lower Hudson Valley).

For each event you are given, choose exactly ONE category from this list and judge whether it is family friendly.

CATEGORIES (use the exact enum name):

- MUSIC — Music: concerts, live bands, jazz, DJ sets, open mics, singer-songwriters, choirs.
  Examples: "Jazz at Maureen's Jazz Cellar", "Live music at Olive's", "Open mic night at The Hudson House".
- COMEDY — Comedy: stand-up, improv, sketch, comedy showcases.
  Examples: "Levity Live presents Gary Gulman", "Improv jam at Nyack Center", "Comedy open mic".
- MOVIES — Movies: film screenings, documentaries, film festivals, outdoor movie nights.
  Examples: "Rivertown Film: Casablanca", "Documentary screening + Q&A", "Movie night in Memorial Park".
- THEATER — Theater: plays, musicals, dance performances, staged readings, opera.
  Examples: "Elmwood Playhouse: Our Town", "Nyack High School spring musical", "Dance recital at the Nyack Center".
- FAMILY_KIDS — Family & Kids: events primarily aimed at children or whole families.
  Examples: "Storytime at Nyack Library", "Kids' Halloween parade on Main Street", "Toddler playgroup".
- FOOD_DRINK — Food & Drink: tastings, dinners, brunches, restaurant weeks, bar nights, trivia and bar games.
  Examples: "Trivia night at Olive's", "Wine tasting at Nyack Wine Cellar", "Rockland Restaurant Week dinner".
- SPORTS_RECREATION — Sports & Recreation: athletics, races, fitness, wellness and movement sessions (yoga, meditation, sound baths, reiki, tai chi), hikes, nature walks, outdoor recreation, games and clubs.
  Examples: "Chess club meetup at Nyack Library", "5K run on the Hudson River path", "Yoga in Memorial Park", "Sound bath at the Nyack Library".
- COMMUNITY_GOVERNMENT — Community: civic and village meetings, public hearings, volunteering, fundraisers, markets, street fairs, parades, religious services, support groups.
  Examples: "Village Board of Trustees meeting", "Nyack Farmers Market", "Riverfront cleanup with Keep Rockland Beautiful".
- ART_GALLERIES — Art & Galleries: exhibitions, gallery openings, artist talks, art walks, craft fairs.
  Examples: "Opening reception at Rockland Center for the Arts", "Artist talk at Edward Hopper House", "Nyack art walk".
- CLASSES_WORKSHOPS — Classes & Workshops: instructional sessions where attendees learn or make something.
  Examples: "Watercolor workshop at RoCA", "Beginner knitting class at the library", "Resume writing seminar".
- OTHER — Other: use ONLY when nothing above fits. Almost every real event fits one of the categories above; do not reach for OTHER because the title is short or vague — infer from the venue and description.

THIN TITLES — USE THE VENUE:
Many listings have a bare title ("Ceramics", "Adults", "RTB-2026") and little or no description. Do NOT answer OTHER in that case: the VENUE and SOURCE tell you what kind of event it is.
- Rockland Center for the Arts (RoCA), Edward Hopper House, Garner Arts Center, any gallery → an exhibition, reception or artist talk is ART_GALLERIES; a named medium or skill ("Ceramics", "Glass and Jewelry", "Adults", "Teens", "Painting") is a studio class, so CLASSES_WORKSHOPS (FAMILY_KIDS if it is explicitly for children).
- Nyack Library, Valley Cottage Library, Nyack Center → a talk, lecture, author event, or club is CLASSES_WORKSHOPS or COMMUNITY_GOVERNMENT; a children's program is FAMILY_KIDS.
- Olive's, Maureen's Jazz Cellar, The Angel Nyack, Casa del Sol, Hudson House and other bars/restaurants → a performer name, band name, "open mic", "jam", "karaoke" or "DJ" is MUSIC; trivia, bingo and tastings are FOOD_DRINK.
- Parks, preserves and trails (River Hook, Nyack Beach, Hook Mountain, Rockland Lake) → walks, hikes, cleanups and nature programs are SPORTS_RECREATION unless they are explicitly civic/volunteer organizing, which is COMMUNITY_GOVERNMENT.
Only answer OTHER when the title, description, venue AND source together still give you nothing to go on.

TIE-BREAKERS:
- Judge by the ACTIVITY, not the venue. Live music at a restaurant is MUSIC, not FOOD_DRINK. A lecture in a gallery is still ART_GALLERIES only if it is about art; otherwise CLASSES_WORKSHOPS or COMMUNITY_GOVERNMENT.
- If attendees are being taught a skill, prefer CLASSES_WORKSHOPS over the subject's category — unless it is explicitly for children, which is FAMILY_KIDS.
- If the event is explicitly for kids or "all ages, families welcome" as its main pitch, prefer FAMILY_KIDS over the activity category.
- Village/town/county meetings, hearings, and elections are always COMMUNITY_GOVERNMENT.

FAMILY FRIENDLY:
- true = children are welcome and would plausibly enjoy or be admitted (library programs, parades, markets, daytime outdoor events, all-ages shows).
- false = 21+, bar-only, explicit/adult content, or clearly adults-only in subject matter.
- null = genuinely unclear from the information given.

CONFIDENCE:
- "high" = the title/description states the activity plainly.
- "medium" = a reasonable inference from the venue, source, or partial information. A venue-based inference from the rules above is "medium", not "low".
- "low" = mostly a guess, with nothing in the title, description, venue or source to support it.

OUTPUT:
Return ONLY valid JSON, no markdown fences and no commentary, in this exact shape, with one entry per input event, in the same order, using the same "index" values you were given:
{"results":[{"index":1,"category":"MUSIC","isFamilyFriendly":true,"confidence":"high"}]}`;

export function buildCategorizeUserPrompt(inputs: CategorizeInput[]): string {
  const lines = inputs.map((input, i) => {
    const parts = [`${i + 1}. TITLE: ${input.title}`];
    if (input.venue) parts.push(`   VENUE: ${input.venue}`);
    if (input.sourceName) parts.push(`   SOURCE: ${input.sourceName}`);
    if (input.description) {
      const desc = input.description.replace(/\s+/g, ' ').slice(0, 500);
      parts.push(`   DESCRIPTION: ${desc}`);
    }
    return parts.join('\n');
  });

  return `Categorize these ${inputs.length} event(s). Return ${inputs.length} result(s) with index 1..${inputs.length}.

${lines.join('\n\n')}`;
}

function fallbackResult(input: CategorizeInput): CategorizeResult {
  return {
    category: guessCategory(input.title, input.description),
    isFamilyFriendly: null,
    confidence: 'low',
  };
}

/**
 * Parses a model response into per-input results.
 *
 * Exported for tests. Any entry that is missing, malformed, or carries an
 * unknown category falls back to `guessCategory()` with `confidence: 'low'`.
 * Never throws.
 */
export function parseCategorizeResponse(
  text: string,
  inputs: CategorizeInput[]
): CategorizeResult[] {
  const results = inputs.map((input) => fallbackResult(input));

  let cleaned = (text || '').trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/```$/, '');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.trim());
  } catch {
    console.warn(
      `[categorize] could not parse model response as JSON, falling back to keywords: ${cleaned.slice(0, 200)}`
    );
    return results;
  }

  const rawResults =
    parsed && typeof parsed === 'object' && Array.isArray((parsed as { results?: unknown }).results)
      ? ((parsed as { results: unknown[] }).results)
      : Array.isArray(parsed)
        ? (parsed as unknown[])
        : null;

  if (!rawResults) {
    console.warn('[categorize] model response missing "results" array, falling back to keywords');
    return results;
  }

  rawResults.forEach((raw, position) => {
    if (!raw || typeof raw !== 'object') return;
    const entry = raw as {
      index?: unknown;
      category?: unknown;
      isFamilyFriendly?: unknown;
      confidence?: unknown;
    };

    // Prefer the model's index (1-based); fall back to array position.
    const rawIndex = typeof entry.index === 'number' ? entry.index - 1 : position;
    if (!Number.isInteger(rawIndex) || rawIndex < 0 || rawIndex >= inputs.length) return;

    const category =
      typeof entry.category === 'string' && VALID_CATEGORIES.has(entry.category.trim().toUpperCase())
        ? (entry.category.trim().toUpperCase() as Category)
        : null;

    if (!category) {
      // Unknown category -> keep the keyword fallback for this row.
      return;
    }

    const confidence =
      entry.confidence === 'high' || entry.confidence === 'medium' || entry.confidence === 'low'
        ? entry.confidence
        : 'medium';

    let isFamilyFriendly: boolean | null = null;
    if (typeof entry.isFamilyFriendly === 'boolean') {
      isFamilyFriendly = entry.isFamilyFriendly;
    } else if (entry.isFamilyFriendly === 'true') {
      isFamilyFriendly = true;
    } else if (entry.isFamilyFriendly === 'false') {
      isFamilyFriendly = false;
    }

    results[rawIndex] = { category, isFamilyFriendly, confidence };
  });

  return results;
}

async function callOpenAI(
  inputs: CategorizeInput[],
  config: CategorizeConfig
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set in environment variables');

  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: config.model,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    messages: [
      { role: 'system', content: CATEGORIZE_SYSTEM_PROMPT },
      { role: 'user', content: buildCategorizeUserPrompt(inputs) },
    ],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No content in OpenAI response');
  return content;
}

async function callAnthropic(
  inputs: CategorizeInput[],
  config: CategorizeConfig
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set in environment variables');

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: config.model,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    system: CATEGORIZE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildCategorizeUserPrompt(inputs) }],
  });

  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text content in Claude response');
  }
  return textContent.text;
}

/**
 * One AI call for one batch. Falls back to the secondary provider, then to
 * keyword guessing. Never throws.
 */
async function categorizeBatch(
  inputs: CategorizeInput[],
  config: CategorizeConfig
): Promise<CategorizeResult[]> {
  const run = (cfg: CategorizeConfig) =>
    cfg.provider === 'openai' ? callOpenAI(inputs, cfg) : callAnthropic(inputs, cfg);

  try {
    return parseCategorizeResponse(await run(config), inputs);
  } catch (primaryError) {
    console.warn(
      `[categorize] primary provider (${config.provider}) failed, trying fallback`,
      primaryError instanceof Error ? primaryError.message : primaryError
    );

    const fallbackProvider: AIProvider =
      config.provider === 'openai' ? 'anthropic' : 'openai';

    try {
      return parseCategorizeResponse(
        await run({
          ...config,
          provider: fallbackProvider,
          model: process.env.AI_CATEGORIZE_MODEL || CHEAP_MODELS[fallbackProvider],
        }),
        inputs
      );
    } catch (fallbackError) {
      console.warn(
        `[categorize] fallback provider (${fallbackProvider}) failed too, using keyword guess`,
        fallbackError instanceof Error ? fallbackError.message : fallbackError
      );
      return inputs.map((input) => fallbackResult(input));
    }
  }
}

/**
 * Categorize a batch of events, returning results plus call/cache stats.
 *
 * Never throws.
 */
export async function categorizeEventsWithStats(
  inputs: CategorizeInput[]
): Promise<{ results: CategorizeResult[]; stats: CategorizeStats }> {
  const stats: CategorizeStats = { total: inputs.length, apiCalls: 0, cached: 0 };
  const results: CategorizeResult[] = new Array(inputs.length);

  if (inputs.length === 0) {
    return { results, stats };
  }

  // Resolve from cache, and de-duplicate identical events within the batch so
  // the same content is never sent twice in one run.
  const pending: { key: string; input: CategorizeInput; positions: number[] }[] = [];
  const pendingByKey = new Map<string, (typeof pending)[number]>();

  inputs.forEach((input, i) => {
    const key = categorizeCacheKey(input);
    const hit = categorizeCache.get(key);
    if (hit) {
      results[i] = hit;
      stats.cached++;
      return;
    }
    const existing = pendingByKey.get(key);
    if (existing) {
      existing.positions.push(i);
      return;
    }
    const entry = { key, input, positions: [i] };
    pendingByKey.set(key, entry);
    pending.push(entry);
  });

  if (pending.length === 0) {
    return { results, stats };
  }

  const config = getCategorizeConfig();

  for (let i = 0; i < pending.length; i += CATEGORIZE_BATCH_SIZE) {
    const chunk = pending.slice(i, i + CATEGORIZE_BATCH_SIZE);
    stats.apiCalls++;
    const chunkResults = await categorizeBatch(
      chunk.map((c) => c.input),
      config
    );

    chunk.forEach((entry, j) => {
      const result = chunkResults[j] ?? fallbackResult(entry.input);
      // Only cache confident answers; a keyword fallback should be retried
      // next run rather than pinned for the process lifetime.
      if (result.confidence !== 'low') {
        categorizeCache.set(entry.key, result);
      }
      for (const position of entry.positions) {
        results[position] = result;
      }
    });
  }

  return { results, stats };
}

/**
 * Categorize a batch of events (batches of ~20 per API call). Never throws.
 */
export async function categorizeEvents(
  inputs: CategorizeInput[]
): Promise<CategorizeResult[]> {
  const { results } = await categorizeEventsWithStats(inputs);
  return results;
}

/**
 * Categorize a single event. Never throws.
 */
export async function categorizeEvent(
  input: CategorizeInput
): Promise<CategorizeResult> {
  const [result] = await categorizeEvents([input]);
  return result ?? fallbackResult(input);
}

/* -------------------------------------------------------------------------- */
/* Ingest helpers                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Scrapers that hard-code a real category for every event they produce. Their
 * category is authoritative and the classifier does not second-guess it
 * (except for the rare row that still comes through as OTHER).
 */
export const TRUSTED_CATEGORY_SOURCES: ReadonlySet<string> = new Set([
  'Levity Live', // COMEDY
  'Elmwood Playhouse', // THEATER
  'Rivertown Film', // MOVIES
  "Maureen's Jazz Cellar", // MUSIC
  'Village of Nyack', // COMMUNITY_GOVERNMENT
  'Rockland County Chess Club', // mapped from the source's own category field
]);

/**
 * Decide the category to store, given what the scraper supplied.
 *
 * Exported for tests.
 */
export function resolveIngestCategory(
  scraperCategory: Category,
  result: CategorizeResult
): Category {
  // A low-confidence answer is just the keyword guess; only let it through
  // when the scraper had nothing better.
  if (result.confidence === 'low') {
    return scraperCategory === Category.OTHER ? result.category : scraperCategory;
  }
  return result.category;
}

/**
 * Decide the isFamilyFriendly value to store.
 *
 * Only ever flips `false` -> `true`, and only on a high-confidence answer.
 * Never flips `true` -> `false`.
 *
 * Exported for tests.
 */
export function resolveIngestFamilyFriendly(
  scraperValue: boolean,
  result: CategorizeResult
): boolean {
  if (!scraperValue && result.isFamilyFriendly === true && result.confidence === 'high') {
    return true;
  }
  return scraperValue;
}

/**
 * Categorize a scraper run's events in place, before they are inserted.
 *
 * - Skips events that already exist in the DB (by source hash), so daily
 *   re-scrapes cost nothing.
 * - Skips trusted-category scrapers unless the event still says OTHER.
 * - Batches everything remaining into ~20-per-call AI requests.
 * - Logs one line per scraper run: `[categorize] 14 events, 1 API call, 9 cached`.
 *
 * Never throws: on any failure the events are left exactly as the scraper
 * produced them.
 */
export async function categorizeScrapedEvents(
  events: ScrapedEvent[],
  sourceName: string
): Promise<void> {
  if (events.length === 0) return;

  try {
    const trusted = TRUSTED_CATEGORY_SOURCES.has(sourceName);

    // Only events the scraper could not categorize well.
    let candidates = events.filter(
      (e) => !trusted || e.category === Category.OTHER
    );
    if (candidates.length === 0) {
      console.log(
        `[categorize] ${sourceName}: 0 events, 0 API calls, 0 cached (trusted source)`
      );
      return;
    }

    // Skip events that already exist — the update path must not re-categorize
    // (admins may have hand-corrected the category).
    // Imported lazily so the classifier itself stays free of DB/scraper deps.
    const [{ prisma }, { generateEventHash }] = await Promise.all([
      import('@/lib/db'),
      import('@/lib/scrapers/utils'),
    ]);

    const hashes = new Map<ScrapedEvent, string>();
    for (const e of candidates) {
      hashes.set(e, generateEventHash(e.title, e.venue, e.startDate));
    }

    const existing = await prisma.event.findMany({
      where: { sourceHash: { in: Array.from(hashes.values()) } },
      select: { sourceHash: true },
    });
    const existingHashes = new Set(existing.map((e) => e.sourceHash));
    candidates = candidates.filter((e) => !existingHashes.has(hashes.get(e)!));

    if (candidates.length === 0) {
      console.log(`[categorize] ${sourceName}: 0 new events, 0 API calls, 0 cached`);
      return;
    }

    const { results, stats } = await categorizeEventsWithStats(
      candidates.map((e) => ({
        title: e.title,
        description: e.description,
        venue: e.venue,
        sourceName: e.sourceName,
      }))
    );

    candidates.forEach((event, i) => {
      const result = results[i];
      if (!result) return;
      event.category = resolveIngestCategory(event.category, result);
      event.isFamilyFriendly = resolveIngestFamilyFriendly(
        event.isFamilyFriendly,
        result
      );
    });

    console.log(
      `[categorize] ${sourceName}: ${stats.total} events, ${stats.apiCalls} API call${
        stats.apiCalls === 1 ? '' : 's'
      }, ${stats.cached} cached`
    );
  } catch (error) {
    console.error('[categorize] failed, leaving scraper categories as-is:', error);
  }
}
