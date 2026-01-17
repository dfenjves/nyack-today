// Date utilities for filtering events

export function getToday(): Date {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now
}

export function getTomorrow(): Date {
  const tomorrow = getToday()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return tomorrow
}

export function getEndOfToday(): Date {
  const end = getToday()
  end.setHours(23, 59, 59, 999)
  return end
}

export function getEndOfTomorrow(): Date {
  const end = getTomorrow()
  end.setHours(23, 59, 59, 999)
  return end
}

export function getWeekendStart(): Date {
  const today = getToday()
  const dayOfWeek = today.getDay()
  // Saturday is 6, Sunday is 0
  const daysUntilSaturday = dayOfWeek === 0 ? 0 : dayOfWeek === 6 ? 0 : 6 - dayOfWeek
  const saturday = new Date(today)
  saturday.setDate(today.getDate() + daysUntilSaturday)
  return saturday
}

export function getWeekendEnd(): Date {
  const weekendStart = getWeekendStart()
  const sunday = new Date(weekendStart)
  // If we're already on Sunday, end of today
  if (weekendStart.getDay() === 0) {
    sunday.setHours(23, 59, 59, 999)
    return sunday
  }
  // Otherwise, end of Sunday
  sunday.setDate(weekendStart.getDate() + 1)
  sunday.setHours(23, 59, 59, 999)
  return sunday
}

export function getWeekEnd(): Date {
  const today = getToday()
  const weekEnd = new Date(today)
  weekEnd.setDate(today.getDate() + 7)
  weekEnd.setHours(23, 59, 59, 999)
  return weekEnd
}

export type DateFilter = 'tonight' | 'tomorrow' | 'weekend' | 'week'

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
    default:
      return { start: now, end: getWeekEnd() }
  }
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
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
