import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { toSourceConfig } from '@/lib/scrapers/generic'
import { dryRunSource } from '@/lib/sources/dry-run'

export const maxDuration = 300

/**
 * POST /api/admin/sources/[id]/test
 *
 * Dry run of a saved source: fetch + extract and return the would-be events.
 * Writes nothing — no events, no submissions, no ScraperLog row, and the
 * source's lastRunAt is left alone.
 *
 * To test values that have not been saved yet (the Add/Edit form's own Test
 * button), POST the config to /api/admin/sources/test instead.
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

    const config = toSourceConfig(source)
    const result = await dryRunSource(config)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Test source error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to test source' },
      { status: 500 }
    )
  }
}
