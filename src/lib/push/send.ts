import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'

/**
 * Expo push fan-out.
 *
 * We POST directly to Expo's push service (no APNs integration required — Expo
 * manages the APNs key). Modeled structurally on the webhook fan-out in
 * src/lib/utils/notifications.ts. Dead tokens (DeviceNotRegistered) are pruned
 * by flipping Device.isActive off so the list stays clean.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const CHUNK_SIZE = 100 // Expo accepts up to 100 messages per request

export interface PushMessage {
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default' | null
}

export interface PushResult {
  sent: number
  failed: number
  deactivated: number
}

interface ExpoTicket {
  status: 'ok' | 'error'
  id?: string
  message?: string
  details?: { error?: string }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * Send a single message to an explicit list of Expo push tokens.
 * Returns delivery counts and prunes tokens Expo reports as unregistered.
 */
export async function sendPushToTokens(
  tokens: string[],
  message: PushMessage
): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, deactivated: 0 }
  if (tokens.length === 0) return result

  const deadTokens: string[] = []

  for (const batch of chunk(tokens, CHUNK_SIZE)) {
    const payload = batch.map((to) => ({
      to,
      title: message.title,
      body: message.body,
      data: message.data ?? {},
      sound: message.sound === undefined ? 'default' : message.sound,
    }))

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const json = (await res.json().catch(() => null)) as { data?: ExpoTicket[] } | null
      const tickets = json?.data ?? []

      batch.forEach((token, i) => {
        const ticket = tickets[i]
        if (ticket?.status === 'ok') {
          result.sent++
        } else {
          result.failed++
          if (ticket?.details?.error === 'DeviceNotRegistered') deadTokens.push(token)
        }
      })
    } catch (error) {
      console.error('Expo push batch failed:', error)
      result.failed += batch.length
    }
  }

  if (deadTokens.length > 0) {
    const { count } = await prisma.device.updateMany({
      where: { expoPushToken: { in: deadTokens } },
      data: { isActive: false },
    })
    result.deactivated = count
  }

  return result
}

/**
 * Send a message to every active device matching an optional preference filter.
 * Pass e.g. { wantsDailyTonight: true } for the nightly digest.
 */
export async function sendPushToDevices(
  where: Prisma.DeviceWhereInput,
  message: PushMessage
): Promise<PushResult> {
  const devices = await prisma.device.findMany({
    where: { isActive: true, ...where },
    select: { expoPushToken: true },
  })
  return sendPushToTokens(
    devices.map((d) => d.expoPushToken),
    message
  )
}
