import { NextRequest, NextResponse } from 'next/server'

/**
 * Server-side gate for all /api/admin/* routes.
 *
 * Historically these routes (stats, events, submissions, subscribers, etc.) had
 * no server-side auth — only the client UI gated access — so subscriber emails
 * and submissions were publicly reachable. This centralizes the check so every
 * admin route is protected, including ones that don't check auth themselves.
 *
 * Accepted credentials (matching the rest of the app's shared-secret scheme):
 *  - `admin_password` cookie (set by the admin UI at login, scoped to /api/admin
 *    so the browser sends it automatically on every admin API call)
 *  - `x-admin-password: <ADMIN_PASSWORD>` header (legacy admin UI calls)
 *  - `Authorization: Bearer <ADMIN_PASSWORD>` (used by /api/admin/cleanup)
 *  - `Authorization: Bearer <CRON_SECRET>` (Vercel cron)
 *
 * The login route (/api/admin/auth) is exempt — it verifies the password from
 * the request body and must be reachable before the header can be set.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname === '/api/admin/auth') {
    return NextResponse.next()
  }

  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    // Fail closed rather than leaving admin data open when misconfigured.
    return NextResponse.json({ error: 'Admin auth not configured' }, { status: 503 })
  }

  const cookiePassword = request.cookies.get('admin_password')?.value
  const headerPassword = request.headers.get('x-admin-password')
  const authHeader = request.headers.get('authorization')
  const cronSecret =
    process.env.CRON_SECRET || process.env.DIGEST_CRON_SECRET || process.env.SCRAPER_API_KEY

  const authorized =
    (cookiePassword !== undefined && decodeURIComponent(cookiePassword) === adminPassword) ||
    headerPassword === adminPassword ||
    authHeader === `Bearer ${adminPassword}` ||
    (Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`)

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/admin/:path*'],
}
