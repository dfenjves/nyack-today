import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/db'

export function buildImagePrompt(
  title: string,
  venue: string,
  description: string | null,
): string {
  const eventDetail = description
    ? `"${title}" at ${venue} — ${description.slice(0, 200)}`
    : `"${title}" at ${venue}`

  return (
    `A photographic scene capturing the spirit of the event: ${eventDetail}. ` +
    `Family friendly, street photography style, candid moment, natural light, ` +
    `small Hudson Valley riverside town setting, authentic emotions. ` +
    `No text, signs, or watermarks in the image.`
  )
}

export async function GET() {
  const events = await prisma.event.findMany({
    where: { isMarquee: true },
    select: {
      id: true,
      title: true,
      category: true,
      venue: true,
      startDate: true,
      description: true,
      imageUrl: true,
    },
    orderBy: { startDate: 'asc' },
  })

  return NextResponse.json({
    events: events.map((e) => ({
      ...e,
      imageUrl: e.imageUrl || null,
      suggestedPrompt: buildImagePrompt(e.title, e.venue, e.description),
    })),
  })
}

export async function POST(request: NextRequest) {
  const adminPassword = request.headers.get('x-admin-password')
  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
  }

  const body = await request.json()
  const { eventId, prompt } = body as { eventId?: string; prompt?: string }

  if (!eventId || !prompt?.trim()) {
    return NextResponse.json({ error: 'eventId and prompt are required' }, { status: 400 })
  }

  try {
    const client = new OpenAI({ apiKey })

    const imageResponse = await client.images.generate({
      model: 'dall-e-3',
      prompt: prompt.trim(),
      n: 1,
      size: '1792x1024',
      quality: 'standard',
      style: 'natural',
    })

    const openAiUrl = imageResponse.data?.[0]?.url
    if (!openAiUrl) throw new Error('No image URL returned from DALL-E 3')

    // Download — OpenAI URLs expire after ~1 hour
    const imgFetch = await fetch(openAiUrl)
    if (!imgFetch.ok) throw new Error('Failed to download generated image')
    const imgBuffer = Buffer.from(await imgFetch.arrayBuffer())

    const filename = `event-images/generated-${eventId}-${Date.now()}.png`
    const blob = await put(filename, imgBuffer, {
      access: 'public',
      contentType: 'image/png',
    })

    await prisma.event.update({
      where: { id: eventId },
      data: { imageUrl: blob.url },
    })

    return NextResponse.json({ imageUrl: blob.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
