import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Device registration for iOS push notifications.
 *
 * Accountless: the Expo push token is the identity. The app calls POST on every
 * launch (idempotent upsert) and PATCH/DELETE when the user changes preferences.
 * No auth — the token itself is the credential and only scopes push to that device.
 */

// Expo tokens look like "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" (also the
// legacy "ExpoPushToken[...]"). Reject anything else so we don't store junk.
const EXPO_TOKEN_PATTERN = /^Expo(nent)?PushToken\[[^\]]+\]$/

const VALID_SEVERITIES = ['INFO', 'ADVISORY', 'WARNING', 'EMERGENCY']

function isValidToken(token: unknown): token is string {
  return typeof token === 'string' && EXPO_TOKEN_PATTERN.test(token)
}

/**
 * Collect the optional notification-preference fields present in a request body.
 * Only keys that are actually provided are returned, so PATCH can do partial
 * updates and POST can apply them on create/update.
 */
function extractPrefs(data: Record<string, unknown>) {
  const prefs: Record<string, unknown> = {}
  if (typeof data.platform === 'string') prefs.platform = data.platform
  if (typeof data.appVersion === 'string') prefs.appVersion = data.appVersion
  if (typeof data.wantsDailyTonight === 'boolean') prefs.wantsDailyTonight = data.wantsDailyTonight
  if (typeof data.wantsAlerts === 'boolean') prefs.wantsAlerts = data.wantsAlerts
  if (data.alertMinSeverity === null || VALID_SEVERITIES.includes(data.alertMinSeverity as string)) {
    if ('alertMinSeverity' in data) prefs.alertMinSeverity = data.alertMinSeverity
  }
  return prefs
}

/**
 * POST /api/devices
 * Register or refresh a device. Idempotent upsert keyed on expoPushToken.
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json().catch(() => ({}))
    if (!isValidToken(data.expoPushToken)) {
      return NextResponse.json({ error: 'Invalid or missing expoPushToken' }, { status: 400 })
    }

    const prefs = extractPrefs(data)
    const device = await prisma.device.upsert({
      where: { expoPushToken: data.expoPushToken },
      // On refresh: reactivate (a token can come back after being pruned) and
      // touch lastSeenAt, applying any preference changes sent along.
      update: { ...prefs, isActive: true, lastSeenAt: new Date() },
      create: { expoPushToken: data.expoPushToken, ...prefs },
    })

    return NextResponse.json({ device }, { status: 201 })
  } catch (error) {
    console.error('Device registration error:', error)
    return NextResponse.json({ error: 'Failed to register device' }, { status: 500 })
  }
}

/**
 * PATCH /api/devices
 * Update notification preferences for an already-registered device.
 */
export async function PATCH(request: NextRequest) {
  try {
    const data = await request.json().catch(() => ({}))
    if (!isValidToken(data.expoPushToken)) {
      return NextResponse.json({ error: 'Invalid or missing expoPushToken' }, { status: 400 })
    }

    const prefs = extractPrefs(data)
    try {
      const device = await prisma.device.update({
        where: { expoPushToken: data.expoPushToken },
        data: { ...prefs, lastSeenAt: new Date() },
      })
      return NextResponse.json({ device })
    } catch {
      return NextResponse.json({ error: 'Device not registered' }, { status: 404 })
    }
  } catch (error) {
    console.error('Device update error:', error)
    return NextResponse.json({ error: 'Failed to update device' }, { status: 500 })
  }
}

/**
 * DELETE /api/devices
 * Deactivate a device (opt out of all push). Soft-delete so re-registration works.
 */
export async function DELETE(request: NextRequest) {
  try {
    const data = await request.json().catch(() => ({}))
    if (!isValidToken(data.expoPushToken)) {
      return NextResponse.json({ error: 'Invalid or missing expoPushToken' }, { status: 400 })
    }

    await prisma.device.updateMany({
      where: { expoPushToken: data.expoPushToken },
      data: { isActive: false },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Device deactivation error:', error)
    return NextResponse.json({ error: 'Failed to deactivate device' }, { status: 500 })
  }
}
