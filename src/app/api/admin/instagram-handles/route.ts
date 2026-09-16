import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getEnvHandles, isValidHandle, normalizeHandle } from '@/lib/instagram/handles'

/**
 * GET /api/admin/instagram-handles
 * Every monitored handle with per-handle stats from InstagramPost, plus which
 * handles are also present in the legacy INSTAGRAM_HANDLES env var.
 *
 * Auth is handled centrally by src/middleware.ts for all /api/admin/* routes.
 */
export async function GET() {
  try {
    const [rows, stats] = await Promise.all([
      prisma.instagramHandle.findMany({ orderBy: { handle: 'asc' } }),
      prisma.instagramPost.groupBy({
        by: ['handle'],
        _count: { _all: true },
        _sum: { eventsExtracted: true },
        _max: { postedAt: true },
      }),
    ])

    const statsByHandle = new Map(
      stats.map((row) => [
        row.handle.toLowerCase(),
        {
          postsProcessed: row._count._all,
          eventsExtracted: row._sum.eventsExtracted ?? 0,
          lastPostAt: row._max.postedAt?.toISOString() ?? null,
        },
      ])
    )

    const envHandles = getEnvHandles()
    const inDb = new Set(rows.map((row) => row.handle))
    const envOnly = envHandles.filter((handle) => !inDb.has(handle))

    return NextResponse.json({
      handles: rows.map((row) => ({
        ...row,
        inEnv: envHandles.includes(row.handle),
        ...(statsByHandle.get(row.handle) ?? {
          postsProcessed: 0,
          eventsExtracted: 0,
          lastPostAt: null,
        }),
      })),
      // Handles the scraper still uses only because they are in the env var.
      envOnly,
    })
  } catch (error) {
    console.error('List Instagram handles error:', error)
    return NextResponse.json({ error: 'Failed to fetch Instagram handles' }, { status: 500 })
  }
}

/**
 * POST /api/admin/instagram-handles
 * Add a handle. Body: { handle, venueName?, notes? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const handle = normalizeHandle(String(body.handle ?? ''))
    if (!isValidHandle(handle)) {
      return NextResponse.json(
        { error: 'Enter an Instagram username: letters, numbers, periods, underscores (no @)' },
        { status: 400 }
      )
    }

    const created = await prisma.instagramHandle.create({
      data: {
        handle,
        venueName: String(body.venueName ?? '').trim() || null,
        notes: String(body.notes ?? '').trim() || null,
      },
    })
    return NextResponse.json({ handle: created }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'That handle is already in the list' }, { status: 409 })
    }
    console.error('Create Instagram handle error:', error)
    return NextResponse.json({ error: 'Failed to add handle' }, { status: 500 })
  }
}
