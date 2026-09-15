import { NextRequest, NextResponse } from 'next/server'
import { dryRunSource } from '@/lib/sources/dry-run'
import { SourceValidationError, toDryRunConfig } from '@/lib/sources/validation'

export const maxDuration = 300

/**
 * POST /api/admin/sources/test
 *
 * Dry run of a source config that has not been saved. This is what makes
 * onboarding a source take minutes: paste a URL, hit Test, see what comes
 * back, adjust the fetch mode or default venue, test again, then save.
 *
 * Writes nothing.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const config = toDryRunConfig(body)
    const result = await dryRunSource(config)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof SourceValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Test source config error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to test source' },
      { status: 500 }
    )
  }
}
