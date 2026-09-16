import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

/**
 * PATCH /api/admin/instagram-handles/[id]
 * Update venueName, notes, or enabled. The handle itself is immutable; delete
 * and re-add to change it, so InstagramPost history stays attached.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    const data: Prisma.InstagramHandleUpdateInput = {}

    if (body.venueName !== undefined) data.venueName = String(body.venueName).trim() || null
    if (body.notes !== undefined) data.notes = String(body.notes).trim() || null
    if (body.enabled !== undefined) data.enabled = Boolean(body.enabled)

    const updated = await prisma.instagramHandle.update({ where: { id }, data })
    return NextResponse.json({ handle: updated })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Handle not found' }, { status: 404 })
    }
    console.error('Update Instagram handle error:', error)
    return NextResponse.json({ error: 'Failed to update handle' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/instagram-handles/[id]
 * Removes the handle from the list. Processed posts and submissions are kept.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.instagramHandle.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Handle not found' }, { status: 404 })
    }
    console.error('Delete Instagram handle error:', error)
    return NextResponse.json({ error: 'Failed to delete handle' }, { status: 500 })
  }
}
