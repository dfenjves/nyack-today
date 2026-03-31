import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const POSTER_SYSTEM_PROMPT = `You are an event details extractor. You will be given an image of an event poster and must extract structured event information from it.

Extract all visible event details and return ONLY valid JSON (no markdown, no explanations).

**Output schema:**
{
  "title": "string - event name",
  "description": "string | null - event description or details",
  "date": "string | null - date in YYYY-MM-DD format (e.g. 2026-04-15), or null if not found",
  "startTime": "string | null - start time in HH:MM 24-hour format (e.g. 19:00), or null if not found",
  "endTime": "string | null - end time in HH:MM 24-hour format, or null if not found",
  "venue": "string | null - venue or location name",
  "address": "string | null - street address if visible",
  "city": "string - city name, default to Nyack if not specified",
  "price": "string | null - price text (e.g. '$20', '$15-$30', 'Free'), or null if not found",
  "isFree": "boolean - true if event is explicitly free",
  "isFamilyFriendly": "boolean - true if poster indicates family-friendly or all ages",
  "category": "string - one of: MUSIC, COMEDY, MOVIES, THEATER, FAMILY_KIDS, FOOD_DRINK, SPORTS_RECREATION, COMMUNITY_GOVERNMENT, ART_GALLERIES, CLASSES_WORKSHOPS, OTHER",
  "sourceUrl": "string | null - any URL or website shown on the poster"
}

**Rules:**
- Today's date is ${new Date().toISOString().split('T')[0]}. If a date is shown without a year, infer the most logical upcoming year.
- Return ALL fields, using null for anything not found on the poster.
- For category, make your best guess based on the event type.
- If the poster shows a QR code or website URL, include it in sourceUrl.
- Do NOT wrap the response in markdown code blocks.`

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (10MB for poster scans)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size must be under 10MB' },
        { status: 400 }
      )
    }

    // Convert to base64
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      )
    }

    const client = new OpenAI({ apiKey })

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1024,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: POSTER_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract all event details from this poster image.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json(
        { error: 'No response from AI' },
        { status: 500 }
      )
    }

    // Parse the JSON response
    let parsed
    try {
      let cleaned = content.trim()
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '')
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '')
      }
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      )
    }

    return NextResponse.json({ event: parsed })
  } catch (error) {
    console.error('Poster extraction error:', error)
    return NextResponse.json(
      { error: 'Failed to extract event details from poster' },
      { status: 500 }
    )
  }
}
