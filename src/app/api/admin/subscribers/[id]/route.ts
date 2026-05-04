import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const subscriber = await prisma.subscriber.update({
      where: { id },
      data: { isActive: body.isActive },
    })

    return NextResponse.json({ subscriber })
  } catch (error) {
    console.error('Admin subscribers PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update subscriber' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.subscriber.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin subscribers DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete subscriber' }, { status: 500 })
  }
}
