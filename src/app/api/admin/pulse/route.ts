import { NextResponse } from 'next/server'
import { getPulse } from '@/lib/utils/pulse-query'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/pulse
 * Coverage grid (14 Eastern days × category), source health, and audience counts
 * for the admin Pulse page. Auth is enforced by src/middleware.ts.
 */
export async function GET() {
  try {
    const pulse = await getPulse()
    return NextResponse.json(pulse, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('Pulse API error:', error)
    return NextResponse.json(
      { error: 'Failed to build pulse' },
      { status: 500, headers: { 'Cache-Control': 'private, no-store' } }
    )
  }
}
