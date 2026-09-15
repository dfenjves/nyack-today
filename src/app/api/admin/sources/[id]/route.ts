import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { slugify } from '@/lib/scrapers/generic'
import {
  parseCategory,
  parseFetchMode,
  parseTriState,
  parseUrls,
  SourceValidationError,
} from '@/lib/sources/validation'

/**
 * PATCH /api/admin/sources/[id]
 * Update any field, including enabled, autoPublish, and cleanRuns.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    const data: Prisma.SourceUpdateInput = {}

    if (body.name !== undefined) {
      const name = String(body.name).trim()
      if (!name) throw new SourceValidationError('Name cannot be empty')
      data.name = name
      // Keep the slug in step with the name unless one is given explicitly.
      if (body.slug === undefined) data.slug = slugify(name)
    }
    if (body.slug !== undefined) {
      const slug = slugify(String(body.slug))
      if (!slug) throw new SourceValidationError('Slug cannot be empty')
      data.slug = slug
    }
    if (body.urls !== undefined) {
      const urls = parseUrls(body.urls)
      if (urls.length === 0) throw new SourceValidationError('At least one URL is required')
      data.urls = urls
    }
    if (body.fetchMode !== undefined) data.fetchMode = parseFetchMode(body.fetchMode)
    if (body.defaultVenue !== undefined) data.defaultVenue = String(body.defaultVenue).trim() || null
    if (body.defaultAddress !== undefined) data.defaultAddress = String(body.defaultAddress).trim() || null
    if (body.defaultCity !== undefined) data.defaultCity = String(body.defaultCity).trim() || 'Nyack'
    if (body.isNyackProper !== undefined) data.isNyackProper = Boolean(body.isNyackProper)
    if (body.defaultCategory !== undefined) data.defaultCategory = parseCategory(body.defaultCategory)
    if (body.familyFriendlyHint !== undefined) data.familyFriendlyHint = parseTriState(body.familyFriendlyHint)
    if (body.autoPublish !== undefined) data.autoPublish = Boolean(body.autoPublish)
    if (body.enabled !== undefined) data.enabled = Boolean(body.enabled)
    if (body.notes !== undefined) data.notes = String(body.notes).trim() || null
    if (body.cleanRuns !== undefined) {
      const cleanRuns = Number(body.cleanRuns)
      if (!Number.isInteger(cleanRuns) || cleanRuns < 0) {
        throw new SourceValidationError('cleanRuns must be a non-negative integer')
      }
      data.cleanRuns = cleanRuns
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const source = await prisma.source.update({ where: { id }, data })
    return NextResponse.json({ source })
  } catch (error) {
    if (error instanceof SourceValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ error: 'Source not found' }, { status: 404 })
      }
      if (error.code === 'P2002') {
        return NextResponse.json({ error: 'Another source already uses that name or slug' }, { status: 409 })
      }
    }
    console.error('Update source error:', error)
    return NextResponse.json({ error: 'Failed to update source' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/sources/[id]
 *
 * Removes the configuration row only. Events and submissions this source
 * produced keep their `sourceName` string, so history and Pulse stay intact.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const source = await prisma.source.delete({ where: { id } })
    return NextResponse.json({ deleted: source.name })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 })
    }
    console.error('Delete source error:', error)
    return NextResponse.json({ error: 'Failed to delete source' }, { status: 500 })
  }
}
