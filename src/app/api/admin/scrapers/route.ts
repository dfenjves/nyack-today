import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * GET /api/admin/scrapers
 * Fetch scraper logs for admin view
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const source = searchParams.get('source')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const where: Record<string, unknown> = {}
    if (status) {
      where.status = status
    }
    if (source) {
      where.sourceName = source
    }

    const logs = await prisma.scraperLog.findMany({
      where,
      orderBy: { runAt: 'desc' },
      take: Math.min(limit, 200),
    })

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('Scraper logs API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scraper logs' },
      { status: 500 }
    )
  }
}
