/**
 * Tests for the AI categorizer's JSON validation and fallback paths.
 *
 * Run: npm test   (node --test via tsx)
 *
 * These tests make no network calls: the provider-failure case works by
 * clearing both API keys so the client constructors throw.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { Category } from '@prisma/client'
import {
  parseCategorizeResponse,
  categorizeEvent,
  categorizeEvents,
  clearCategorizeCache,
  resolveIngestCategory,
  resolveIngestFamilyFriendly,
  buildCategorizeUserPrompt,
  type CategorizeInput,
} from '../src/lib/ai/categorize'

const inputs: CategorizeInput[] = [
  { title: 'Jazz at Maureen\'s', venue: "Maureen's Jazz Cellar" },
  { title: 'Village Board of Trustees meeting', venue: 'Village Hall' },
]

test('parses a well-formed response', () => {
  const results = parseCategorizeResponse(
    JSON.stringify({
      results: [
        { index: 1, category: 'MUSIC', isFamilyFriendly: true, confidence: 'high' },
        {
          index: 2,
          category: 'COMMUNITY_GOVERNMENT',
          isFamilyFriendly: false,
          confidence: 'medium',
        },
      ],
    }),
    inputs
  )

  assert.equal(results.length, 2)
  assert.equal(results[0].category, Category.MUSIC)
  assert.equal(results[0].isFamilyFriendly, true)
  assert.equal(results[0].confidence, 'high')
  assert.equal(results[1].category, Category.COMMUNITY_GOVERNMENT)
  assert.equal(results[1].confidence, 'medium')
})

test('strips markdown code fences', () => {
  const results = parseCategorizeResponse(
    '```json\n{"results":[{"index":1,"category":"MUSIC","isFamilyFriendly":null,"confidence":"high"}]}\n```',
    [inputs[0]]
  )
  assert.equal(results[0].category, Category.MUSIC)
  assert.equal(results[0].isFamilyFriendly, null)
})

test('falls back to guessCategory on unparseable JSON', () => {
  const results = parseCategorizeResponse('not json at all {{{', inputs)

  assert.equal(results.length, 2)
  // guessCategory finds "jazz" -> MUSIC and "meeting" -> COMMUNITY_GOVERNMENT
  assert.equal(results[0].category, Category.MUSIC)
  assert.equal(results[0].confidence, 'low')
  assert.equal(results[0].isFamilyFriendly, null)
  assert.equal(results[1].category, Category.COMMUNITY_GOVERNMENT)
  assert.equal(results[1].confidence, 'low')
})

test('falls back when the results array is missing', () => {
  const results = parseCategorizeResponse('{"categories": ["MUSIC"]}', [inputs[0]])
  assert.equal(results[0].confidence, 'low')
  assert.equal(results[0].category, Category.MUSIC) // keyword fallback
})

test('falls back per-row on an unknown category', () => {
  const results = parseCategorizeResponse(
    JSON.stringify({
      results: [
        { index: 1, category: 'KARAOKE', isFamilyFriendly: true, confidence: 'high' },
        { index: 2, category: 'COMMUNITY_GOVERNMENT', isFamilyFriendly: true, confidence: 'high' },
      ],
    }),
    inputs
  )

  // Row 1 is invalid -> keyword fallback at low confidence
  assert.equal(results[0].confidence, 'low')
  assert.equal(results[0].category, Category.MUSIC)
  // Row 2 is unaffected
  assert.equal(results[1].confidence, 'high')
  assert.equal(results[1].category, Category.COMMUNITY_GOVERNMENT)
})

test('falls back for rows the model omitted', () => {
  const results = parseCategorizeResponse(
    JSON.stringify({
      results: [{ index: 1, category: 'MUSIC', isFamilyFriendly: true, confidence: 'high' }],
    }),
    inputs
  )
  assert.equal(results[0].confidence, 'high')
  assert.equal(results[1].confidence, 'low')
})

test('ignores out-of-range indexes instead of throwing', () => {
  const results = parseCategorizeResponse(
    JSON.stringify({
      results: [
        { index: 99, category: 'MUSIC', confidence: 'high' },
        { index: 0, category: 'MUSIC', confidence: 'high' },
        null,
        'garbage',
      ],
    }),
    inputs
  )
  assert.equal(results.length, 2)
  assert.equal(results[0].confidence, 'low')
  assert.equal(results[1].confidence, 'low')
})

test('defaults an unknown confidence value to medium', () => {
  const results = parseCategorizeResponse(
    JSON.stringify({ results: [{ index: 1, category: 'MUSIC', confidence: 'certain' }] }),
    [inputs[0]]
  )
  assert.equal(results[0].confidence, 'medium')
})

test('categorizeEvent falls back when the provider throws', async () => {
  const openai = process.env.OPENAI_API_KEY
  const anthropic = process.env.ANTHROPIC_API_KEY
  delete process.env.OPENAI_API_KEY
  delete process.env.ANTHROPIC_API_KEY
  clearCategorizeCache()

  try {
    const result = await categorizeEvent({
      title: 'Open mic comedy night',
      venue: 'Casa del Sol',
    })
    assert.equal(result.confidence, 'low')
    assert.equal(result.category, Category.COMEDY) // keyword fallback
    assert.equal(result.isFamilyFriendly, null)

    const batch = await categorizeEvents([
      { title: 'Watercolor workshop' },
      { title: 'Zzzz unknowable happening' },
    ])
    assert.equal(batch.length, 2)
    assert.equal(batch[0].category, Category.CLASSES_WORKSHOPS)
    assert.equal(batch[1].category, Category.OTHER)
    assert.ok(batch.every((r) => r.confidence === 'low'))
  } finally {
    if (openai) process.env.OPENAI_API_KEY = openai
    if (anthropic) process.env.ANTHROPIC_API_KEY = anthropic
    clearCategorizeCache()
  }
})

test('categorizeEvents returns an empty array for no input', async () => {
  assert.deepEqual(await categorizeEvents([]), [])
})

test('resolveIngestCategory keeps a scraper category over a low-confidence guess', () => {
  assert.equal(
    resolveIngestCategory(Category.THEATER, {
      category: Category.MUSIC,
      isFamilyFriendly: null,
      confidence: 'low',
    }),
    Category.THEATER
  )
  // ...but a low-confidence answer still beats OTHER
  assert.equal(
    resolveIngestCategory(Category.OTHER, {
      category: Category.MUSIC,
      isFamilyFriendly: null,
      confidence: 'low',
    }),
    Category.MUSIC
  )
  // high/medium confidence wins
  assert.equal(
    resolveIngestCategory(Category.THEATER, {
      category: Category.MUSIC,
      isFamilyFriendly: null,
      confidence: 'medium',
    }),
    Category.MUSIC
  )
})

test('resolveIngestFamilyFriendly never flips true to false', () => {
  const highTrue = { category: Category.MUSIC, isFamilyFriendly: true, confidence: 'high' } as const
  const highFalse = { category: Category.MUSIC, isFamilyFriendly: false, confidence: 'high' } as const
  const mediumTrue = { category: Category.MUSIC, isFamilyFriendly: true, confidence: 'medium' } as const

  assert.equal(resolveIngestFamilyFriendly(false, highTrue), true)
  assert.equal(resolveIngestFamilyFriendly(true, highFalse), true)
  assert.equal(resolveIngestFamilyFriendly(false, mediumTrue), false)
  assert.equal(resolveIngestFamilyFriendly(false, highFalse), false)
})

test('the user prompt numbers every event', () => {
  const prompt = buildCategorizeUserPrompt(inputs)
  assert.match(prompt, /1\. TITLE: Jazz at Maureen's/)
  assert.match(prompt, /2\. TITLE: Village Board of Trustees meeting/)
  assert.match(prompt, /index 1\.\.2/)
})
