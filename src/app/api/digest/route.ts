import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { Event } from '@prisma/client'
import { prisma } from '@/lib/db'
import { generateDigestHtml, generateDigestText } from '@/lib/utils/email'

async function generateWeeklySummary(events: Event[], weekLabel: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return `${events.length} events happening in Nyack this week!`

  try {
    const OpenAI = (await import('openai')).default
    const client = new OpenAI({ apiKey })

    const eventList = events
      .slice(0, 20)
      .map(
        (e) =>
          `- ${e.title} at ${e.venue} on ${new Date(e.startDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' })}${e.isFree ? ' (Free)' : ''}`
      )
      .join('\n')

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `Write a warm, fun 2-3 sentence intro for a weekly community events email for Nyack, NY for the week of ${weekLabel}. Highlight 1-2 specific exciting events. Keep it conversational and local. No generic phrases like "something for everyone."\n\nEvents this week:\n${eventList}`,
        },
      ],
    })

    return response.choices[0]?.message?.content ?? `${events.length} events happening in Nyack this week!`
  } catch (error) {
    console.error('OpenAI summary generation failed:', error)
    return `${events.length} events happening in Nyack this week!`
  }
}

function buildWeekLabel(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })
  return `${fmt(start)} – ${fmt(end)}`
}

export async function POST(request: NextRequest) {
  const adminPassword = request.headers.get('x-admin-password')
  const cronHeader = request.headers.get('authorization')

  const hasValidAdmin = Boolean(
    process.env.ADMIN_PASSWORD && adminPassword === process.env.ADMIN_PASSWORD
  )
  const hasValidCron =
    Boolean(process.env.DIGEST_CRON_SECRET) &&
    cronHeader === `Bearer ${process.env.DIGEST_CRON_SECRET}`

  if (!hasValidAdmin && !hasValidCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
  }

  // Thursday send: cover Friday (tomorrow) through the following Thursday
  const now = new Date()
  const digestStart = new Date(now)
  digestStart.setDate(now.getDate() + 1)
  digestStart.setHours(0, 0, 0, 0)

  const digestEnd = new Date(now)
  digestEnd.setDate(now.getDate() + 7)
  digestEnd.setHours(23, 59, 59, 999)

  const weekLabel = buildWeekLabel(digestStart, digestEnd)

  const [subscribers, events] = await Promise.all([
    prisma.subscriber.findMany({ where: { isActive: true } }),
    prisma.event.findMany({
      where: {
        isHidden: false,
        startDate: { gte: digestStart, lte: digestEnd },
      },
      orderBy: { startDate: 'asc' },
      take: 50,
    }),
  ])

  if (subscribers.length === 0) {
    return NextResponse.json({ message: 'No active subscribers', eventCount: events.length })
  }

  const aiSummary = await generateWeeklySummary(events, weekLabel)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const resend = new Resend(apiKey)
  const subject = `Nyack This Week — ${weekLabel}`

  let sent = 0
  for (const sub of subscribers) {
    const unsubUrl = `${siteUrl}/api/unsubscribe?token=${sub.unsubscribeToken}`
    try {
      await resend.emails.send({
        from: 'Nyack Today <submissions@nyacktoday.com>',
        to: sub.email,
        subject,
        html: generateDigestHtml(events, aiSummary, unsubUrl, weekLabel),
        text: generateDigestText(events, aiSummary, unsubUrl, weekLabel),
      })
      sent++
    } catch (error) {
      console.error(`Failed to send digest to ${sub.email}:`, error)
    }
  }

  console.log(`Digest sent: ${sent}/${subscribers.length} subscribers, ${events.length} events, week: ${weekLabel}`)

  return NextResponse.json({
    subscriberCount: sent,
    eventCount: events.length,
    weekLabel,
    aiSummary,
  })
}
