import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { runScraper } from '@/lib/scrapers'

export const maxDuration = 300

/**
 * POST /api/admin/sources/[id]/run
 *
 * Real run of a single source through the normal orchestrator path, so it gets
 * a ScraperLog row and its events are saved (or queued for review, when
 * autoPublish is off) exactly as they would be on the nightly run.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const source = await prisma.source.findUnique({ where: { id } })

    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 })
    }
    if (!source.enabled) {
      return NextResponse.json(
        { error: `${source.name} is disabled — enable it before running` },
        { status: 400 }
      )
    }

    const result = await runScraper(source.name)
    if (!result) {
      return NextResponse.json(
        { error: `Scraper not found for source "${source.name}"` },
        { status: 404 }
      )
    }

    const updated = await prisma.source.findUnique({ where: { id } })

    return NextResponse.json({
      result: {
        sourceName: result.sourceName,
        status: result.status,
        eventsFound: result.eventsFound ?? result.events.length,
        eventsPublished: result.events.length,
        errorMessage: result.errorMessage,
      },
      source: updated,
    })
  } catch (error) {
    console.error('Run source error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run source' },
      { status: 500 }
    )
  }
}
