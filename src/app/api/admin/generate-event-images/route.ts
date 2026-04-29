import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/db'

function buildImagePrompt(
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

const noImage = { OR: [{ imageUrl: null }, { imageUrl: '' }] }

export async function GET() {
  const events = await prisma.event.findMany({
    where: { isMarquee: true, ...noImage },
    select: { id: true, title: true, category: true, venue: true, startDate: true },
    orderBy: { startDate: 'asc' },
  })
  return NextResponse.json({ events, count: events.length })
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

  const events = await prisma.event.findMany({
    where: { isMarquee: true, ...noImage },
    select: { id: true, title: true, venue: true, description: true },
  })

  if (events.length === 0) {
    return NextResponse.json({ generated: [], count: 0 })
  }

  const client = new OpenAI({ apiKey })
  const results: { id: string; title: string; imageUrl: string | null; error?: string }[] = []

  for (const event of events) {
    try {
      const prompt = buildImagePrompt(event.title, event.venue, event.description)

      const imageResponse = await client.images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1792x1024',
        quality: 'standard',
        style: 'natural',
      })

      const openAiUrl = imageResponse.data?.[0]?.url
      if (!openAiUrl) throw new Error('No image URL returned from DALL-E 3')

      // Download the image — OpenAI URLs expire after ~1 hour
      const imgFetch = await fetch(openAiUrl)
      if (!imgFetch.ok) throw new Error('Failed to download generated image')
      const imgBuffer = Buffer.from(await imgFetch.arrayBuffer())

      // Upload to Vercel Blob for permanent storage
      const filename = `event-images/generated-${event.id}-${Date.now()}.png`
      const blob = await put(filename, imgBuffer, {
        access: 'public',
        contentType: 'image/png',
      })

      await prisma.event.update({
        where: { id: event.id },
        data: { imageUrl: blob.url },
      })

      results.push({ id: event.id, title: event.title, imageUrl: blob.url })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      results.push({ id: event.id, title: event.title, imageUrl: null, error: message })
    }
  }

  return NextResponse.json({
    generated: results,
    count: results.filter((r) => r.imageUrl).length,
  })
}
