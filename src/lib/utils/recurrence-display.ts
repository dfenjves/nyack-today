// Display utilities for recurring events
// Formats recurrence patterns into human-readable strings

import { getNextOccurrences } from './recurrence'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_ABBREVIATIONS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Format recurrence days array into human-readable string
 *
 * @param days - Array of day numbers (0=Sun, 1=Mon, ..., 6=Sat)
 * @param useAbbreviations - Use abbreviated day names (Mon vs Monday)
 * @returns Formatted string like "Every Monday", "Every Mon, Wed, Fri", or "Every day"
 *
 * @example
 * formatRecurrenceDays([2]) // "Every Tuesday"
 * formatRecurrenceDays([1, 3, 5]) // "Every Mon, Wed, Fri"
 * formatRecurrenceDays([0, 1, 2, 3, 4, 5, 6]) // "Every day"
 */
export function formatRecurrenceDays(days: number[], useAbbreviations: boolean = true): string {
  if (!days || days.length === 0) {
    return ''
  }

  // Sort days for consistent display
  const sortedDays = [...days].sort((a, b) => a - b)

  // Special case: all 7 days
  if (sortedDays.length === 7) {
    return 'Every day'
  }

  // Special case: weekdays only (Mon-Fri)
  if (sortedDays.length === 5 && sortedDays.every((d) => d >= 1 && d <= 5)) {
    return 'Every weekday'
  }

  // Special case: weekends only (Sat-Sun)
  if (sortedDays.length === 2 && sortedDays[0] === 0 && sortedDays[1] === 6) {
    return 'Every weekend'
  }

  const dayNames = useAbbreviations ? DAY_ABBREVIATIONS : DAY_NAMES

  // Single day
  if (sortedDays.length === 1) {
    return `Every ${dayNames[sortedDays[0]]}`
  }

  // Multiple days
  const formattedDays = sortedDays.map((d) => dayNames[d]).join(', ')
  return `Every ${formattedDays}`
}

/**
 * Format complete recurrence pattern including end date
 *
 * @param days - Array of recurrence days
 * @param endDate - Optional end date for the recurrence
 * @returns Full description like "Every Tuesday" or "Every Mon, Wed until Mar 15, 2026"
 *
 * @example
 * formatRecurrencePattern([2], null) // "Every Tuesday"
 * formatRecurrencePattern([1, 3, 5], new Date('2026-03-15')) // "Every Mon, Wed, Fri until Mar 15, 2026"
 */
export function formatRecurrencePattern(days: number[], endDate: Date | null): string {
  const daysStr = formatRecurrenceDays(days, true)

  if (!endDate) {
    return daysStr
  }

  const endDateStr = endDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  })

  return `${daysStr} until ${endDateStr}`
}

/**
 * Get preview of upcoming occurrences for display
 *
 * @param event - Event with recurrence information
 * @param count - Number of occurrences to show (default 5)
 * @returns Array of formatted date strings
 *
 * @example
 * getOccurrencePreview(event, 3)
 * // ["Tue, Mar 11", "Tue, Mar 18", "Tue, Mar 25"]
 */
export function getOccurrencePreview(
  event: {
    startDate: Date
    recurrenceDays: number[]
    recurrenceEndDate: Date | null
  },
  count: number = 5
): string[] {
  const occurrences = getNextOccurrences(event, new Date(), count)

  return occurrences.map((date) =>
    date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/New_York',
    })
  )
}

/**
 * Get day name from day number
 */
export function getDayName(dayNumber: number, abbreviated: boolean = false): string {
  const names = abbreviated ? DAY_ABBREVIATIONS : DAY_NAMES
  return names[dayNumber] || ''
}

/**
 * Get all day names for day selector UI
 */
export function getAllDayNames(abbreviated: boolean = true): string[] {
  return abbreviated ? [...DAY_ABBREVIATIONS] : [...DAY_NAMES]
}
