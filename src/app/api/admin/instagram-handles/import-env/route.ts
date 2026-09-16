import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getEnvHandles } from '@/lib/instagram/handles'

/**
 * POST /api/admin/instagram-handles/import-env
 * Copies every handle from the legacy INSTAGRAM_HANDLES env var into the
 * InstagramHandle table (skipping ones already there), so the env var can be
 * removed from Vercel afterwards.
 */
export async function POST() {
  try {
    const envHandles = getEnvHandles()
    if (envHandles.length === 0) {
      return NextResponse.json({ imported: [], skipped: [], message: 'INSTAGRAM_HANDLES is empty or unset' })
    }

    const existing = await prisma.instagramHandle.findMany({
      where: { handle: { in: envHandles } },
      select: { handle: true },
    })
    const already = new Set(existing.map((row) => row.handle))
    const toImport = envHandles.filter((handle) => !already.has(handle))

    if (toImport.length > 0) {
      await prisma.instagramHandle.createMany({
        data: toImport.map((handle) => ({ handle, notes: 'Imported from INSTAGRAM_HANDLES' })),
        skipDuplicates: true,
      })
    }

    return NextResponse.json({ imported: toImport, skipped: Array.from(already) })
  } catch (error) {
    console.error('Import Instagram handles error:', error)
    return NextResponse.json({ error: 'Failed to import handles' }, { status: 500 })
  }
}
