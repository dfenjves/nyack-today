import { NextRequest, NextResponse } from 'next/server'
import type { Event } from '@prisma/client'
import { queryEvents } from '@/lib/utils/events-query'
import { isCronOrAdminAuthorized } from '@/lib/auth'
import { sendPushToDevices } from '@/lib/push/send'

/**
 * Daily "Tonight in Nyack" push — the app's headline retention feature.
 *
 * Triggered by Vercel cron (see vercel.json). Selects tonight's events with the
 * same logic the web/app use (queryEvents), composes a short blurb, and fans out
 * to devices that opted into the daily notification. Deep-links to the top event.
 */

async function generateTonightBlurb(events: Event[]): Promise<string> {
  const top = events.slice(0, 5)
  const fallback =
    top.length === 1
      ? `${top[0].title} at ${top[0].venue} tonight.`
      : `${events.length} things happening in Nyack tonight — tap to see what's on.`

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return fallback

  try {
    const OpenAI = (await import('openai')).default
    const client = new OpenAI({ apiKey })
    const list = top
      .map((e) => `- ${e.title} at ${e.venue}${e.isFree ? ' (Free)' : ''}`)
      .join('\n')

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 120,
      messages: [
        {
          role: 'user',
          content: `Write a single punchy notification body (max ~140 chars, no emoji spam, at most one emoji) inviting Nyack, NY residents to tonight's events. Mention one specific event by name. Conversational and local, no generic filler.\n\nTonight:\n${list}`,
        },
      ],
    })

    return response.choices[0]?.message?.content?.trim() || fallback
  } catch (error) {
    console.error('Tonight blurb generation failed:', error)
    return fallback
  }
}

async function sendTonight() {
  const events = await queryEvents({ dateFilter: 'tonight', limit: 10 })

  if (events.length === 0) {
    return NextResponse.json({ message: 'No events tonight — skipping push', sent: 0 })
  }

  const body = await generateTonightBlurb(events)
  const result = await sendPushToDevices(
    { wantsDailyTonight: true },
    {
      title: 'Tonight in Nyack 🌆',
      body,
      // Deep-link to the top event; the app opens the detail screen.
      data: { url: `nyacktoday://event/${events[0].id}`, type: 'tonight' },
    }
  )

  console.log(
    `Tonight push: ${result.sent} sent, ${result.failed} failed, ${result.deactivated} pruned, ${events.length} events`
  )
  return NextResponse.json({ eventCount: events.length, ...result })
}

// Vercel cron uses GET; POST allows manual/admin triggering.
export async function GET(request: NextRequest) {
  if (!isCronOrAdminAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return sendTonight()
}

export async function POST(request: NextRequest) {
  if (!isCronOrAdminAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return sendTonight()
}
