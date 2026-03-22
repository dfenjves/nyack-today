/**
 * Parse a datetime string as Eastern Time and return a UTC Date object
 * Input: "2026-03-21T21:00" -> Parse as 9PM Eastern -> Store as UTC
 *
 * This ensures that when users submit "9PM", it's stored as 9PM Eastern,
 * not 9PM in whatever timezone the server happens to be running in.
 */
export function parseEasternTime(dateTimeString: string): Date {
  // Extract date/time components
  const parts = dateTimeString.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!parts) {
    throw new Error('Invalid datetime format. Expected: YYYY-MM-DDTHH:mm')
  }

  const [, year, month, day, hour, minute] = parts

  // Create a date as if it were UTC (not local time)
  const utcDate = new Date(Date.UTC(
    parseInt(year),
    parseInt(month) - 1, // Month is 0-indexed
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    0,
    0
  ))

  // Now we need to find the offset for Eastern time at this date
  // (to handle DST correctly)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  // Format the UTC date in Eastern timezone
  const easternParts = formatter.formatToParts(utcDate)
  const getVal = (type: string) => easternParts.find(p => p.type === type)?.value || '0'

  // Create a date from the Eastern formatted parts
  const easternAsUtc = new Date(Date.UTC(
    parseInt(getVal('year')),
    parseInt(getVal('month')) - 1,
    parseInt(getVal('day')),
    parseInt(getVal('hour')),
    parseInt(getVal('minute')),
    parseInt(getVal('second')),
    0
  ))

  // The difference tells us the offset
  const offsetMs = utcDate.getTime() - easternAsUtc.getTime()

  // Apply the offset to get the correct UTC time
  // If Eastern is 5 hours behind UTC, and we want 9PM Eastern,
  // we need 2AM UTC (9PM + 5 hours)
  return new Date(utcDate.getTime() + offsetMs)
}
