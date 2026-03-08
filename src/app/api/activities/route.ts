import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Category } from '@prisma/client'

/**
 * GET /api/activities
 * Fetch active activities for public display
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') as Category | null

    const where: Record<string, unknown> = {
      isActive: true,
    }

    if (category && category !== 'ALL') {
      where.category = category
    }

    const activities = await prisma.activity.findMany({
      where,
      orderBy: [
        { isNyackProper: 'desc' }, // Nyack proper first
        { title: 'asc' },
      ],
    })

    return NextResponse.json({ activities })
  } catch (error) {
    console.error('Activities API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    )
  }
}
