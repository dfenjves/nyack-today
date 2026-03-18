// Calendar integration utilities for generating Google Calendar links and ICS files
import { Event } from '@prisma/client'

const TIMEZONE = 'America/New_York'

/**
 * Format a Date to YYYYMMDDTHHMMSS in UTC format for calendar systems
 */
export function formatDateForCalendar(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
}

/**
 * Generate Google Calendar URL with pre-filled event details
 */
export function generateGoogleCalendarUrl(event: Event): string {
  const startDate = new Date(event.startDate)
  const endDate = event.endDate
    ? new Date(event.endDate)
    : new Date(startDate.getTime() + 60 * 60 * 1000) // Default to 1 hour later

  const startFormatted = formatDateForCalendar(startDate)
  const endFormatted = formatDateForCalendar(endDate)

  // Build location string
  const location = event.address
    ? `${event.venue}, ${event.address}, ${event.city}`
    : `${event.venue}, ${event.city}`

  // Build description with source URL
  const description = event.description
    ? `${event.description}\n\nMore info: ${event.sourceUrl}`
    : `More info: ${event.sourceUrl}`

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${startFormatted}/${endFormatted}`,
    details: description,
    location: location,
    sf: 'true',
    output: 'xml',
  })

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/**
 * Escape special characters for ICS format (RFC 5545)
 */
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')  // Escape backslashes
    .replace(/;/g, '\\;')    // Escape semicolons
    .replace(/,/g, '\\,')    // Escape commas
    .replace(/\n/g, '\\n')   // Escape newlines
}

/**
 * Fold long lines at 75 characters per RFC 5545
 */
function foldICSLine(line: string): string {
  if (line.length <= 75) return line

  const lines: string[] = []
  let currentLine = line.substring(0, 75)
  let remaining = line.substring(75)

  lines.push(currentLine)

  while (remaining.length > 0) {
    currentLine = ' ' + remaining.substring(0, 74) // Continuation lines start with space
    remaining = remaining.substring(74)
    lines.push(currentLine)
  }

  return lines.join('\r\n')
}

/**
 * Generate ICS file content (RFC 5545 compliant)
 */
export function generateICSContent(event: Event): string {
  const startDate = new Date(event.startDate)
  const endDate = event.endDate
    ? new Date(event.endDate)
    : new Date(startDate.getTime() + 60 * 60 * 1000) // Default to 1 hour later

  const startFormatted = formatDateForCalendar(startDate)
  const endFormatted = formatDateForCalendar(endDate)

  // Build location string
  const location = event.address
    ? `${event.venue}, ${event.address}, ${event.city}`
    : `${event.venue}, ${event.city}`

  // Build description with source URL
  const description = event.description
    ? `${event.description}\\n\\nMore info: ${event.sourceUrl}`
    : `More info: ${event.sourceUrl}`

  // Generate unique UID
  const uid = `${event.id}@nyacktoday.com`

  // Build ICS content with proper line folding
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nyack Today//Events//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${startFormatted}`,
    `DTEND:${endFormatted}`,
    foldICSLine(`SUMMARY:${escapeICSText(event.title)}`),
    foldICSLine(`DESCRIPTION:${escapeICSText(description)}`),
    foldICSLine(`LOCATION:${escapeICSText(location)}`),
    `URL:${event.sourceUrl}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return lines.join('\r\n')
}

/**
 * Sanitize filename for download (remove special characters, limit length)
 */
function sanitizeFilename(title: string): string {
  return title
    .replace(/[^a-z0-9]/gi, '-')  // Replace non-alphanumeric with dash
    .replace(/-+/g, '-')           // Collapse multiple dashes
    .replace(/^-|-$/g, '')         // Remove leading/trailing dashes
    .substring(0, 50)              // Limit to 50 characters
    .toLowerCase()
}

/**
 * Trigger download of ICS file
 */
export function downloadICS(event: Event): void {
  const icsContent = generateICSContent(event)
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${sanitizeFilename(event.title)}.ics`

  // Trigger download
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Clean up
  URL.revokeObjectURL(url)
}
