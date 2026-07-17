import { NextRequest, NextResponse } from 'next/server'
import { getEventByStableId } from '@/lib/utils/events-query'

/**
 * GET /api/events/[id]
 * Fetch a single event by its stable id (as returned from /api/events).
 *
 * The id is either a one-time event cuid or a recurring occurrence of the form
 * `${parentId}-${YYYY-MM-DD}`. Non-occurrence dates and hidden/missing events
 * return 404. Clients (incl. the iOS app deep links) must treat the id as opaque.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const event = await getEventByStableId(id)

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const response = NextResponse.json({ event })
    // Match the list route's caching so detail views stay cheap at the CDN.
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
    return response
  } catch (error) {
    console.error('Event detail API error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to fetch event', message }, { status: 500 })
  }
}
