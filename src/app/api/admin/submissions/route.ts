import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * GET /api/admin/submissions
 * Fetch submissions for admin review
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status')

    const where: Record<string, unknown> = {}

    if (statusParam) {
      where.status = statusParam
    }

    const submissions = await prisma.eventSubmission.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      take: 200,
    })

    return NextResponse.json({ submissions })
  } catch (error) {
    console.error('Admin submissions API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 }
    )
  }
}
