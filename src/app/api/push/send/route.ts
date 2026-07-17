import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthorized } from '@/lib/auth'
import { sendPushToDevices } from '@/lib/push/send'

/**
 * POST /api/push/send
 * Admin-only ad-hoc push. Lets a human fire a one-off message (e.g. a snow
 * emergency or road closure) before the structured News/Alerts system (Phase 2)
 * exists. Requires the x-admin-password header.
 *
 * Body: { title, body, url?, audience? }
 *   audience: "all" (default) → every active device
 *             "alerts"        → devices with wantsAlerts=true
 */
export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const data = await request.json().catch(() => ({}))
    const { title, body, url, audience } = data

    if (typeof title !== 'string' || !title.trim() || typeof body !== 'string' || !body.trim()) {
      return NextResponse.json({ error: 'title and body are required' }, { status: 400 })
    }

    const where = audience === 'alerts' ? { wantsAlerts: true } : {}
    const result = await sendPushToDevices(where, {
      title,
      body,
      data: url ? { url, type: 'adhoc' } : { type: 'adhoc' },
    })

    console.log(`Ad-hoc push "${title}": ${result.sent} sent, ${result.failed} failed`)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Ad-hoc push error:', error)
    return NextResponse.json({ error: 'Failed to send push' }, { status: 500 })
  }
}
