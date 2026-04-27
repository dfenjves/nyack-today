import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const base = new URL('/unsubscribe', siteUrl)

  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    base.searchParams.set('error', 'missing')
    return NextResponse.redirect(base.toString())
  }

  const subscriber = await prisma.subscriber.findUnique({
    where: { unsubscribeToken: token },
  })

  if (!subscriber) {
    base.searchParams.set('error', 'invalid')
    return NextResponse.redirect(base.toString())
  }

  if (!subscriber.isActive) {
    base.searchParams.set('status', 'already')
    return NextResponse.redirect(base.toString())
  }

  await prisma.subscriber.update({
    where: { unsubscribeToken: token },
    data: { isActive: false },
  })

  base.searchParams.set('status', 'success')
  return NextResponse.redirect(base.toString())
}
