// Shared types, thresholds, and formatting for the admin Pulse page.
// Client-safe: only type imports from Prisma. Server-side computation lives in
// src/lib/utils/pulse-query.ts.

import type { Category } from '@prisma/client'

export const PULSE_THRESHOLDS = {
  thinDayEvents: 5, // total < 5 is 'thin'
  staleSourceDays: 3, // no success in > 3 days is 'stale'
  otherShareWarn: 0.1,
  otherShareBad: 0.2,
}

export const COVERAGE_DAYS = 14

export type CoverageDayStatus = 'ok' | 'thin' | 'empty'
export type SourceStatus = 'ok' | 'stale' | 'zero' | 'never'

export interface PulseCoverageDay {
  date: string // 'YYYY-MM-DD' in Eastern time
  weekday: string // 'Mon'
  startUtc: string // ISO instant of Eastern midnight, for linking to the public site
  endUtc: string // ISO instant of 11:59:59.999 PM Eastern
  total: number
  byCategory: Record<Category, number>
  familyFriendly: number
  free: number
  status: CoverageDayStatus
}

export interface PulseSource {
  sourceName: string
  registered: boolean // false for sources that aren't in src/lib/scrapers/index.ts (e.g. User Submission)
  lastRunAt: string | null
  lastSuccessAt: string | null
  lastStatus: string | null
  eventsFoundLastRun: number
  eventsAddedLast7Days: number
  upcomingEvents: number // non-hidden events from this source in next 30 days
  status: SourceStatus
}

export interface PulseResponse {
  generatedAt: string // ISO
  timezone: 'America/New_York'
  coverage: {
    days: PulseCoverageDay[] // exactly 14 entries, today first
    categoriesWithEventsThisWeek: number // of 11
    otherShare: number // 0..1, share of events in window with category OTHER
  }
  sources: PulseSource[]
  audience: {
    subscribersActive: number
    subscribersLast7Days: number
    devicesActive: number
    devicesLast7Days: number
    submissionsLast7Days: number
    submissionsPending: number
  }
}

export function getDayStatus(total: number): CoverageDayStatus {
  if (total === 0) return 'empty'
  if (total < PULSE_THRESHOLDS.thinDayEvents) return 'thin'
  return 'ok'
}

export function getOtherShareLevel(share: number): 'ok' | 'warn' | 'bad' {
  if (share > PULSE_THRESHOLDS.otherShareBad) return 'bad'
  if (share > PULSE_THRESHOLDS.otherShareWarn) return 'warn'
  return 'ok'
}

/** "just now", "2 min ago", "5h ago", "3d ago" */
export function formatRelative(iso: string | null, now: number = Date.now()): string {
  if (!iso) return '—'
  const diffMs = Math.max(0, now - new Date(iso).getTime())
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
