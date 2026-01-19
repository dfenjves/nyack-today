import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Category } from '@prisma/client'

/**
 * GET /api/admin/activities
 * Fetch activities for admin management
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const activeParam = searchParams.get('active')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const where: Record<string, unknown> = {}
    if (activeParam === 'true') {
      where.isActive = true
    } else if (activeParam === 'false') {
      where.isActive = false
    }

    const activities = await prisma.activity.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: Math.min(limit, 200),
    })

    return NextResponse.json({ activities })
  } catch (error) {
    console.error('Admin activities API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/activities
 * Create a new activity manually
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    if (!data.title || !data.description || !data.venue || !data.address || !data.websiteUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: title, description, venue, address, websiteUrl' },
        { status: 400 }
      )
    }

    if (data.category && !Object.values(Category).includes(data.category)) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      )
    }

    const activity = await prisma.activity.create({
      data: {
        title: data.title,
        description: data.description,
        venue: data.venue,
        address: data.address,
        city: data.city || 'Nyack',
        isNyackProper: data.isNyackProper ?? true,
        category: data.category || 'OTHER',
        price: data.price || null,
        isFree: data.isFree ?? false,
        isFamilyFriendly: data.isFamilyFriendly ?? false,
        hours: data.hours || null,
        websiteUrl: data.websiteUrl,
        imageUrl: data.imageUrl || null,
        isActive: data.isActive ?? true,
      },
    })

    return NextResponse.json({ activity }, { status: 201 })
  } catch (error) {
    console.error('Create activity error:', error)
    return NextResponse.json(
      { error: 'Failed to create activity' },
      { status: 500 }
    )
  }
}
