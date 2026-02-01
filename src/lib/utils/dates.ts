// Date utilities for filtering events
// All dates use Eastern Time (America/New_York) for Nyack, NY
// Database stores UTC, so we convert Eastern boundaries to UTC for queries

const TIMEZONE = 'America/New_York'

/**
 * Get the current date components in Eastern Time
 */
function getEasternDateParts(date: Date = new Date()): {
  year: number
  month: number
  day: number
  hour: number
  dayOfWeek: number
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
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
    dayOfWeek: weekdayMap[get('weekday')] ?? 0,
  }
}

/**
 * Get the UTC offset for Eastern Time at a given date (handles DST)
 * Returns offset in milliseconds (negative for behind UTC)
 */
function getEasternOffset(date: Date = new Date()): number {
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
  // Create a date assuming it's UTC
  const assumedUtc = new Date(Date.UTC(year, month, day, hour, minute, second, ms))

  // Get the offset for that approximate time
  const offset = getEasternOffset(assumedUtc)

  // Subtract offset to convert from Eastern to UTC
  // (if Eastern is behind UTC, offset is negative, so subtracting makes it later)
  return new Date(assumedUtc.getTime() - offset)
}

/**
 * Get start of today in Eastern Time (as UTC Date for DB queries)
 */
export function getToday(): Date {
  const { year, month, day } = getEasternDateParts()
  return easternToUtc(year, month, day, 0, 0, 0, 0)
}

/**
 * Get start of tomorrow in Eastern Time (as UTC Date for DB queries)
 */
export function getTomorrow(): Date {
  const { year, month, day } = getEasternDateParts()
  const tomorrow = new Date(Date.UTC(year, month, day + 1))
  return easternToUtc(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate(), 0, 0, 0, 0)
}

/**
 * Get end of today in Eastern Time (as UTC Date for DB queries)
 */
export function getEndOfToday(): Date {
  const { year, month, day } = getEasternDateParts()
  return easternToUtc(year, month, day, 23, 59, 59, 999)
}

/**
 * Get end of tomorrow in Eastern Time (as UTC Date for DB queries)
 */
export function getEndOfTomorrow(): Date {
  const { year, month, day } = getEasternDateParts()
  const tomorrow = new Date(Date.UTC(year, month, day + 1))
  return easternToUtc(
    tomorrow.getUTCFullYear(),
    tomorrow.getUTCMonth(),
    tomorrow.getUTCDate(),
    23,
    59,
    59,
    999
  )
}

/**
 * Get start of this weekend (Saturday) in Eastern Time
 */
export function getWeekendStart(): Date {
  const { year, month, day, dayOfWeek } = getEasternDateParts()

  // If Sunday, use today; if Saturday, use today; otherwise, next Saturday
  let daysUntilSaturday = 0
  if (dayOfWeek === 0) {
    // Sunday - we're in the weekend, start from today
    daysUntilSaturday = 0
  } else if (dayOfWeek === 6) {
    // Saturday - start from today
    daysUntilSaturday = 0
  } else {
    daysUntilSaturday = 6 - dayOfWeek
  }

  const saturday = new Date(Date.UTC(year, month, day + daysUntilSaturday))
  return easternToUtc(saturday.getUTCFullYear(), saturday.getUTCMonth(), saturday.getUTCDate(), 0, 0, 0, 0)
}

/**
 * Get end of this weekend (Sunday night) in Eastern Time
 */
export function getWeekendEnd(): Date {
  const { year, month, day, dayOfWeek } = getEasternDateParts()

  let daysUntilSunday = 0
  if (dayOfWeek === 0) {
    // Sunday - end of today
    daysUntilSunday = 0
  } else if (dayOfWeek === 6) {
    // Saturday - tomorrow
    daysUntilSunday = 1
  } else {
    // Weekday - this coming Sunday
    daysUntilSunday = 7 - dayOfWeek
  }

  const sunday = new Date(Date.UTC(year, month, day + daysUntilSunday))
  return easternToUtc(sunday.getUTCFullYear(), sunday.getUTCMonth(), sunday.getUTCDate(), 23, 59, 59, 999)
}

/**
 * Get end of the week (7 days from now) in Eastern Time
 */
export function getWeekEnd(): Date {
  const { year, month, day } = getEasternDateParts()
  const weekEnd = new Date(Date.UTC(year, month, day + 7))
  return easternToUtc(weekEnd.getUTCFullYear(), weekEnd.getUTCMonth(), weekEnd.getUTCDate(), 23, 59, 59, 999)
}

/**
 * Get current time in Eastern (as UTC Date for DB queries)
 */
export function getNowInEastern(): Date {
  // Just return now - it's already UTC which is what the DB uses
  // The boundaries (getToday, etc.) handle the timezone conversion
  return new Date()
}

/**
 * Get end of the month (30 days from now) in Eastern Time
 */
export function getMonthEnd(): Date {
  const { year, month, day } = getEasternDateParts()
  const monthEnd = new Date(Date.UTC(year, month, day + 30))
  return easternToUtc(monthEnd.getUTCFullYear(), monthEnd.getUTCMonth(), monthEnd.getUTCDate(), 23, 59, 59, 999)
}

export type DateFilter = 'tonight' | 'tomorrow' | 'weekend' | 'week' | 'month'

export function getDateRange(filter: DateFilter): { start: Date; end: Date } {
  const now = new Date()

  switch (filter) {
    case 'tonight':
      return { start: now, end: getEndOfToday() }
    case 'tomorrow':
      return { start: getTomorrow(), end: getEndOfTomorrow() }
    case 'weekend':
      return { start: getWeekendStart(), end: getWeekendEnd() }
    case 'week':
      return { start: now, end: getWeekEnd() }
    case 'month':
      return { start: now, end: getMonthEnd() }
    default:
      return { start: now, end: getWeekEnd() }
  }
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: TIMEZONE,
  })
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: TIMEZONE,
  })
}

export function formatDateRange(start: Date, end?: Date | null): string {
  const startStr = formatDate(start)
  const timeStr = formatTime(start)

  if (!end) {
    return `${startStr} at ${timeStr}`
  }

  const endTimeStr = formatTime(end)
  return `${startStr}, ${timeStr} - ${endTimeStr}`
}
