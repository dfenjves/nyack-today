import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function GET() {
  try {
    const subscribers = await prisma.subscriber.findMany({
      orderBy: { subscribedAt: 'desc' },
    })
    return NextResponse.json({ subscribers })
  } catch (error) {
    console.error('Admin subscribers GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch subscribers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = (body.email ?? '').trim().toLowerCase()

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
    }

    const subscriber = await prisma.subscriber.upsert({
      where: { email },
      update: { isActive: true },
      create: { email },
    })

    return NextResponse.json({ subscriber })
  } catch (error) {
    console.error('Admin subscribers POST error:', error)
    return NextResponse.json({ error: 'Failed to add subscriber' }, { status: 500 })
  }
}
