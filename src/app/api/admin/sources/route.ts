import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { parseSourceInput, SourceValidationError } from '@/lib/sources/validation'

/**
 * GET /api/admin/sources
 * List every configured source with its last run and pending-submission count.
 *
 * Auth is handled centrally by src/middleware.ts for all /api/admin/* routes.
 */
export async function GET() {
  try {
    const sources = await prisma.source.findMany({ orderBy: { name: 'asc' } })

    // One grouped query instead of one count per source.
    const pendingCounts = await prisma.eventSubmission.groupBy({
      by: ['sourceName'],
      where: {
        status: 'PENDING',
        sourceName: { in: sources.map((source) => source.name) },
      },
      _count: { _all: true },
    })
    const pendingByName = new Map(
      pendingCounts.map((row) => [row.sourceName, row._count._all])
    )

    return NextResponse.json({
      sources: sources.map((source) => ({
        ...source,
        pendingSubmissions: pendingByName.get(source.name) ?? 0,
      })),
    })
  } catch (error) {
    console.error('List sources error:', error)
    return NextResponse.json({ error: 'Failed to fetch sources' }, { status: 500 })
  }
}

/**
 * POST /api/admin/sources
 * Create a source. Slug is derived from the name unless one is supplied.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const input = parseSourceInput(body)

    const source = await prisma.source.create({ data: input })
    return NextResponse.json({ source }, { status: 201 })
  } catch (error) {
    if (error instanceof SourceValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = (error.meta?.target as string[] | undefined)?.join(', ') ?? 'name/slug'
      return NextResponse.json(
        { error: `A source with that ${target} already exists` },
        { status: 409 }
      )
    }
    console.error('Create source error:', error)
    return NextResponse.json({ error: 'Failed to create source' }, { status: 500 })
  }
}
