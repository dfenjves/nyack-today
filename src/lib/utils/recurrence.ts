// Recurrence utilities for generating event instances
// Handles recurring events (e.g., "Every Tuesday", "Every Mon, Wed, Fri")

import type { Event } from '@prisma/client'

const TIMEZONE = 'America/New_York'
const MAX_INSTANCES = 100 // Cap to prevent abuse

/**
 * Get Eastern Time date parts for a given date
 */
function getEasternDateParts(date: Date): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  dayOfWeek: number
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  })

  const parts = formatter.formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value || ''

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }

  return {
    year: parseInt(get('year')),
    month: parseInt(get('month')) - 1, // 0-indexed
    day: parseInt(get('day')),
    hour: parseInt(get('hour')),
    minute: parseInt(get('minute')),
    dayOfWeek: weekdayMap[get('weekday')] ?? 0,
  }
}

/**
 * Get the UTC offset for Eastern Time at a given date (handles DST)
 */
function getEasternOffset(date: Date): number {
  const utcString = date.toLocaleString('en-US', { timeZone: 'UTC' })
  const easternString = date.toLocaleString('en-US', { timeZone: TIMEZONE })
  const utcDate = new Date(utcString)
  const easternDate = new Date(easternString)
  return easternDate.getTime() - utcDate.getTime()
}

/**
 * Create a UTC Date for a specific Eastern Time
 */
function easternToUtc(
  year: number,
  month: number,
  day: number,
  hour: number = 0,
  minute: number = 0,
  second: number = 0,
  ms: number = 0
): Date {
  const assumedUtc = new Date(Date.UTC(year, month, day, hour, minute, second, ms))
  const offset = getEasternOffset(assumedUtc)
  return new Date(assumedUtc.getTime() - offset)
}

/**
 * Check if a given date falls on one of the recurrence days
 */
function isRecurrenceDay(date: Date, recurrenceDays: number[]): boolean {
  const { dayOfWeek } = getEasternDateParts(date)
  return recurrenceDays.includes(dayOfWeek)
}

/**
 * Generate event instances from a recurring event within a date range
 *
 * @param event - The recurring event (must have isRecurring=true)
 * @param rangeStart - Start of date range (inclusive)
 * @param rangeEnd - End of date range (inclusive)
 * @returns Array of virtual event instances
 */
export function generateRecurringInstances(
  event: Event,
  rangeStart: Date,
  rangeEnd: Date
): Event[] {
  if (!event.isRecurring || !event.recurrenceDays || event.recurrenceDays.length === 0) {
    return []
  }

  const instances: Event[] = []

  // Extract time from the event's startDate
  const { hour, minute } = getEasternDateParts(event.startDate)

  // Calculate duration if event has endDate
  const duration = event.endDate
    ? event.endDate.getTime() - event.startDate.getTime()
    : null

  // Start from the later of: event's startDate or rangeStart
  const iterationStart = new Date(Math.max(event.startDate.getTime(), rangeStart.getTime()))

  // End at the earlier of: recurrenceEndDate, rangeEnd, or if neither exists use rangeEnd
  let iterationEnd = rangeEnd
  if (event.recurrenceEndDate) {
    iterationEnd = new Date(Math.min(event.recurrenceEndDate.getTime(), rangeEnd.getTime()))
  }

  // Get Eastern date for iteration start
  let currentDate = new Date(iterationStart)
  const startParts = getEasternDateParts(currentDate)
  currentDate = new Date(Date.UTC(startParts.year, startParts.month, startParts.day))

  // Iterate through each day in the range
  while (currentDate <= iterationEnd && instances.length < MAX_INSTANCES) {
    // Check if this day matches one of the recurrence days
    if (isRecurrenceDay(currentDate, event.recurrenceDays)) {
      const { year, month, day } = getEasternDateParts(currentDate)

      // Create instance with the correct time
      const instanceStartDate = easternToUtc(year, month, day, hour, minute, 0, 0)

      // Only include if it's within the range and after/on the event's original start
      if (
        instanceStartDate >= rangeStart &&
        instanceStartDate <= iterationEnd &&
        instanceStartDate >= event.startDate
      ) {
        // Calculate endDate for this instance if original event has duration
        const instanceEndDate = duration ? new Date(instanceStartDate.getTime() + duration) : null

        // Create virtual event instance
        // Use a unique ID based on the parent event ID and date
        const dateString = instanceStartDate.toISOString().split('T')[0]
        const instance: Event = {
          ...event,
          id: `${event.id}-${dateString}`,
          startDate: instanceStartDate,
          endDate: instanceEndDate,
        }

        instances.push(instance)
      }
    }

    // Move to next day
    const nextDay = new Date(currentDate)
    nextDay.setUTCDate(nextDay.getUTCDate() + 1)
    currentDate = nextDay
  }

  return instances
}

/**
 * Get the next N occurrences of a recurring event starting from a given date
 * Useful for admin preview of upcoming instances
 *
 * @param event - The recurring event
 * @param fromDate - Start date for finding occurrences (defaults to now)
 * @param count - Number of occurrences to return
 * @returns Array of dates for the next N occurrences
 */
export function getNextOccurrences(
  event: {
    startDate: Date
    recurrenceDays: number[]
    recurrenceEndDate: Date | null
  },
  fromDate: Date = new Date(),
  count: number = 5
): Date[] {
  if (!event.recurrenceDays || event.recurrenceDays.length === 0) {
    return []
  }

  const occurrences: Date[] = []
  const { hour, minute } = getEasternDateParts(event.startDate)

  // Start from the later of: event's startDate or fromDate
  const iterationStart = new Date(Math.max(event.startDate.getTime(), fromDate.getTime()))

  let currentDate = new Date(iterationStart)
  const startParts = getEasternDateParts(currentDate)
  currentDate = new Date(Date.UTC(startParts.year, startParts.month, startParts.day))

  // Iterate until we find enough occurrences or hit the end date
  const maxDaysToCheck = 365 // Safety limit
  let daysChecked = 0

  while (occurrences.length < count && daysChecked < maxDaysToCheck) {
    // Check if we've passed the recurrence end date
    if (event.recurrenceEndDate && currentDate > event.recurrenceEndDate) {
      break
    }

    // Check if this day matches one of the recurrence days
    if (isRecurrenceDay(currentDate, event.recurrenceDays)) {
      const { year, month, day } = getEasternDateParts(currentDate)
      const occurrenceDate = easternToUtc(year, month, day, hour, minute, 0, 0)

      // Only include if it's on or after the event's start date
      if (occurrenceDate >= event.startDate && occurrenceDate >= fromDate) {
        occurrences.push(occurrenceDate)
      }
    }

    // Move to next day
    const nextDay = new Date(currentDate)
    nextDay.setUTCDate(nextDay.getUTCDate() + 1)
    currentDate = nextDay
    daysChecked++
  }

  return occurrences
}
