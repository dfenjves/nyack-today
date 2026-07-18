import type { NextRequest } from 'next/server'

/**
 * Shared request authorization for admin and cron endpoints.
 *
 * Two shared secrets exist in this app (there is no per-user identity):
 *  - ADMIN_PASSWORD, sent by the admin UI as the `x-admin-password` header.
 *  - CRON_SECRET (legacy fallbacks DIGEST_CRON_SECRET / SCRAPER_API_KEY), sent by
 *    Vercel cron as `Authorization: Bearer <secret>`.
 *
 * Previously each route re-implemented these checks (see api/digest/route.ts);
 * this centralizes them so new routes stay consistent.
 */

/** True when the request carries the correct admin password header. */
export function isAdminAuthorized(request: NextRequest): boolean {
  const adminPassword = request.headers.get('x-admin-password')
  return Boolean(process.env.ADMIN_PASSWORD && adminPassword === process.env.ADMIN_PASSWORD)
}

/** True when the request carries a valid Vercel cron bearer secret. */
export function isCronAuthorized(request: NextRequest): boolean {
  const cronSecret =
    process.env.CRON_SECRET || process.env.DIGEST_CRON_SECRET || process.env.SCRAPER_API_KEY
  const authHeader = request.headers.get('authorization')
  return Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`
}

/**
 * True for either an authenticated admin or a valid cron caller. Use for
 * endpoints that both Vercel cron and a human admin may trigger (e.g. digests,
 * scheduled pushes).
 */
export function isCronOrAdminAuthorized(request: NextRequest): boolean {
  return isAdminAuthorized(request) || isCronAuthorized(request)
}
