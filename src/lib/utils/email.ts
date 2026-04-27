import { Resend } from 'resend'
import { Event, EventSubmission } from '@prisma/client'
import { categoryLabels, categoryIcons } from './categories'

/**
 * Send email notification when a new event is submitted
 * Uses graceful degradation - logs errors but doesn't throw
 */
export async function sendEventSubmissionEmail(
  submission: EventSubmission
): Promise<void> {
  // Validate environment variables
  const apiKey = process.env.RESEND_API_KEY
  const adminEmail = process.env.ADMIN_EMAIL

  if (!apiKey || !adminEmail) {
    console.warn(
      'Email notification skipped: RESEND_API_KEY or ADMIN_EMAIL not configured'
    )
    return
  }

  try {
    const resend = new Resend(apiKey)

    const htmlContent = generateHtmlEmail(submission)
    const textContent = generatePlainTextEmail(submission)

    await resend.emails.send({
      from: 'Nyack Today <submissions@nyacktoday.com>',
      to: adminEmail,
      subject: `New Event Submission: ${submission.title}`,
      html: htmlContent,
      text: textContent,
    })

    console.log(`Event submission email sent for: ${submission.title}`)
  } catch (error) {
    // Log error but don't throw - email is not critical to submission success
    console.error('Failed to send event submission email:', error)
  }
}

function generateHtmlEmail(submission: EventSubmission): string {
  const categoryLabel = categoryLabels[submission.category]
  const categoryIcon = categoryIcons[submission.category]

  // Format dates
  const startDate = new Date(submission.startDate).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })

  const endDate = submission.endDate
    ? new Date(submission.endDate).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : null

  const submittedAt = new Date(submission.submittedAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  // Format price
  const priceDisplay = submission.isFree
    ? 'Free'
    : submission.price || 'Not specified'

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 0;
    }
    .header {
      background-color: #f97316;
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 20px;
    }
    .event-title {
      font-size: 22px;
      font-weight: 700;
      color: #1c1917;
      margin: 0 0 20px 0;
    }
    .section {
      margin: 20px 0;
      padding: 15px;
      background: #fafaf9;
      border-left: 4px solid #f97316;
      border-radius: 4px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #57534e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 12px 0;
    }
    .field {
      margin-bottom: 12px;
    }
    .label {
      font-weight: 600;
      color: #57534e;
      margin-right: 8px;
    }
    .value {
      color: #1c1917;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
      background-color: #fed7aa;
      color: #9a3412;
    }
    .admin-link {
      display: inline-block;
      margin-top: 20px;
      padding: 12px 24px;
      background: #f97316;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
    }
    .admin-link:hover {
      background: #ea580c;
    }
    .footer {
      margin-top: 30px;
      padding: 20px;
      background: #f5f5f4;
      border-top: 2px solid #e7e5e4;
      font-size: 12px;
      color: #78716c;
    }
    a {
      color: #f97316;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📬 New Event Submission</h1>
  </div>

  <div class="content">
    <h2 class="event-title">${escapeHtml(submission.title)}</h2>

    <div class="section">
      <div class="section-title">Required Information</div>

      <div class="field">
        <span class="label">📅 Start Date & Time:</span>
        <span class="value">${startDate}</span>
      </div>

      ${
        endDate
          ? `
      <div class="field">
        <span class="label">🏁 End Date & Time:</span>
        <span class="value">${endDate}</span>
      </div>
      `
          : ''
      }

      <div class="field">
        <span class="label">📍 Venue:</span>
        <span class="value">${escapeHtml(submission.venue)}</span>
      </div>

      ${
        submission.address
          ? `
      <div class="field">
        <span class="label">🗺️ Address:</span>
        <span class="value">${escapeHtml(submission.address)}, ${escapeHtml(submission.city)}</span>
      </div>
      `
          : ''
      }

      <div class="field">
        <span class="label">📧 Submitter Email:</span>
        <span class="value"><a href="mailto:${escapeHtml(submission.submitterEmail)}">${escapeHtml(submission.submitterEmail)}</a></span>
      </div>
    </div>

    ${
      submission.description ||
      submission.category !== 'OTHER' ||
      submission.price ||
      submission.isFree ||
      submission.isFamilyFriendly ||
      submission.sourceUrl
        ? `
    <div class="section">
      <div class="section-title">Additional Details</div>

      ${
        submission.description
          ? `
      <div class="field">
        <span class="label">📝 Description:</span>
        <div class="value">${escapeHtml(submission.description).replace(/\n/g, '<br>')}</div>
      </div>
      `
          : ''
      }

      <div class="field">
        <span class="label">${categoryIcon} Category:</span>
        <span class="badge">${categoryLabel}</span>
      </div>

      <div class="field">
        <span class="label">💰 Price:</span>
        <span class="value">${escapeHtml(priceDisplay)}</span>
      </div>

      ${
        submission.isFamilyFriendly
          ? `
      <div class="field">
        <span class="label">👨‍👩‍👧‍👦 Family-Friendly:</span>
        <span class="value">Yes</span>
      </div>
      `
          : ''
      }

      ${
        submission.sourceUrl
          ? `
      <div class="field">
        <span class="label">🔗 Event URL:</span>
        <span class="value"><a href="${escapeHtml(submission.sourceUrl)}" target="_blank">${escapeHtml(submission.sourceUrl)}</a></span>
      </div>
      `
          : ''
      }
    </div>
    `
        : ''
    }

    <div style="text-align: center; margin-top: 30px;">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/admin/submissions" class="admin-link">
        Review Submission in Admin Dashboard
      </a>
    </div>
  </div>

  <div class="footer">
    <div><strong>Submission ID:</strong> ${submission.id}</div>
    <div><strong>Submitted:</strong> ${submittedAt}</div>
    <div><strong>Status:</strong> ${submission.status}</div>
  </div>
</body>
</html>
  `.trim()
}

function generatePlainTextEmail(submission: EventSubmission): string {
  const categoryLabel = categoryLabels[submission.category]
  const categoryIcon = categoryIcons[submission.category]

  const startDate = new Date(submission.startDate).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })

  const endDate = submission.endDate
    ? new Date(submission.endDate).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : null

  const submittedAt = new Date(submission.submittedAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const priceDisplay = submission.isFree
    ? 'Free'
    : submission.price || 'Not specified'

  return `
NEW EVENT SUBMISSION
====================

${submission.title}

REQUIRED INFORMATION
--------------------
Start Date & Time: ${startDate}
${endDate ? `End Date & Time: ${endDate}` : ''}
Venue: ${submission.venue}
${submission.address ? `Address: ${submission.address}, ${submission.city}` : ''}
Submitter Email: ${submission.submitterEmail}

ADDITIONAL DETAILS
------------------
${submission.description ? `Description: ${submission.description}\n` : ''}
Category: ${categoryIcon} ${categoryLabel}
Price: ${priceDisplay}
${submission.isFamilyFriendly ? 'Family-Friendly: Yes\n' : ''}
${submission.sourceUrl ? `Event URL: ${submission.sourceUrl}\n` : ''}

ADMIN ACTIONS
-------------
Review in Dashboard: ${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/admin/submissions

Submission ID: ${submission.id}
Submitted: ${submittedAt}
Status: ${submission.status}
  `.trim()
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (char) => map[char])
}

/**
 * Format recurrence pattern for display in emails
 * Example: "Repeats every Tuesday, Thursday" or "Repeats every Monday until March 30, 2026"
 */
function formatRecurrencePattern(
  isRecurring: boolean,
  recurrenceDays: number[],
  recurrenceEndDate: Date | null
): string {
  if (!isRecurring || !recurrenceDays || recurrenceDays.length === 0) {
    return ''
  }

  const dayNames = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ]
  const days = recurrenceDays.map((d) => dayNames[d]).join(', ')

  if (recurrenceEndDate) {
    const endDateStr = new Date(recurrenceEndDate).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
    return `Repeats every ${days} until ${endDateStr}`
  }
  return `Repeats every ${days}`
}

/**
 * Generate HTML email for submission confirmation
 */
function generateConfirmationHtmlEmail(submission: EventSubmission): string {
  const submittedAt = new Date(submission.submittedAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  // Format date/time or recurrence pattern
  let dateDisplay: string
  if (submission.isRecurring) {
    const recurrence = formatRecurrencePattern(
      submission.isRecurring,
      submission.recurrenceDays,
      submission.recurrenceEndDate
    )
    dateDisplay = recurrence || 'Recurring event'
  } else {
    dateDisplay = new Date(submission.startDate).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  // Format time
  const timeDisplay = new Date(submission.startDate).toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 0;
    }
    .header {
      background-color: #f97316;
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 20px;
    }
    .section {
      margin: 20px 0;
      padding: 15px;
      background: #fafaf9;
      border-left: 4px solid #f97316;
      border-radius: 4px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #57534e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 12px 0;
    }
    .field {
      margin-bottom: 12px;
    }
    .label {
      font-weight: 600;
      color: #57534e;
      margin-right: 8px;
    }
    .value {
      color: #1c1917;
    }
    .footer {
      margin-top: 30px;
      padding: 20px;
      background: #f5f5f4;
      border-top: 2px solid #e7e5e4;
      font-size: 12px;
      color: #78716c;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>✉️ Event Submission Received</h1>
  </div>

  <div class="content">
    <p>Hi there!</p>

    <p>Thank you for submitting your event to Nyack Today. We've received your submission and our team will review it shortly.</p>

    <div class="section">
      <div class="section-title">What You Submitted</div>

      <div class="field">
        <span class="label">Title:</span>
        <span class="value">${escapeHtml(submission.title)}</span>
      </div>

      <div class="field">
        <span class="label">${submission.isRecurring ? '📅 Schedule:' : '📅 Date:'}</span>
        <span class="value">${dateDisplay}</span>
      </div>

      <div class="field">
        <span class="label">🕐 Time:</span>
        <span class="value">${timeDisplay}</span>
      </div>

      <div class="field">
        <span class="label">📍 Venue:</span>
        <span class="value">${escapeHtml(submission.venue)}</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">What Happens Next</div>
      <ul style="margin: 0; padding-left: 20px;">
        <li>Our team will review your submission within 24-48 hours</li>
        <li>We'll send you an email when your event is approved or if we need more information</li>
        <li>Once approved, your event will be live on Nyack Today for the community to discover</li>
      </ul>
    </div>

    <p>Questions? Reply to this email or contact us at submissions@nyacktoday.com</p>
  </div>

  <div class="footer">
    <div><strong>Submission ID:</strong> ${submission.id}</div>
    <div><strong>Submitted:</strong> ${submittedAt}</div>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Generate plain text email for submission confirmation
 */
function generateConfirmationPlainTextEmail(
  submission: EventSubmission
): string {
  const submittedAt = new Date(submission.submittedAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  // Format date/time or recurrence pattern
  let dateDisplay: string
  if (submission.isRecurring) {
    const recurrence = formatRecurrencePattern(
      submission.isRecurring,
      submission.recurrenceDays,
      submission.recurrenceEndDate
    )
    dateDisplay = recurrence || 'Recurring event'
  } else {
    dateDisplay = new Date(submission.startDate).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const timeDisplay = new Date(submission.startDate).toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })

  return `
EVENT SUBMISSION RECEIVED
=========================

Hi there!

Thank you for submitting your event to Nyack Today. We've received your submission and our team will review it shortly.

WHAT YOU SUBMITTED
------------------
Title: ${submission.title}
${submission.isRecurring ? 'Schedule:' : 'Date:'} ${dateDisplay}
Time: ${timeDisplay}
Venue: ${submission.venue}

WHAT HAPPENS NEXT
------------------
- Our team will review your submission within 24-48 hours
- We'll send you an email when your event is approved or if we need more information
- Once approved, your event will be live on Nyack Today for the community to discover

Questions? Reply to this email or contact us at submissions@nyacktoday.com

Submission ID: ${submission.id}
Submitted: ${submittedAt}
  `.trim()
}

/**
 * Send confirmation email to submitter when event is submitted
 * Uses graceful degradation - logs errors but doesn't throw
 */
export async function sendSubmissionConfirmationEmail(
  submission: EventSubmission
): Promise<void> {
  // Validate environment variables
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    console.warn(
      'Confirmation email skipped: RESEND_API_KEY not configured'
    )
    return
  }

  try {
    const resend = new Resend(apiKey)

    const htmlContent = generateConfirmationHtmlEmail(submission)
    const textContent = generateConfirmationPlainTextEmail(submission)

    await resend.emails.send({
      from: 'Nyack Today <submissions@nyacktoday.com>',
      to: submission.submitterEmail,
      subject: `Event Submission Received - ${submission.title}`,
      html: htmlContent,
      text: textContent,
    })

    console.log(`Confirmation email sent to: ${submission.submitterEmail}`)
  } catch (error) {
    // Log error but don't throw - email is not critical to submission success
    console.error('Failed to send confirmation email:', error)
  }
}

/**
 * Generate HTML email for submission approval
 */
function generateApprovalHtmlEmail(
  submission: EventSubmission,
  event: Event
): string {
  const approvedAt = new Date(submission.reviewedAt || new Date()).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  // Format date/time or recurrence pattern
  let dateDisplay: string
  if (submission.isRecurring) {
    const recurrence = formatRecurrencePattern(
      submission.isRecurring,
      submission.recurrenceDays,
      submission.recurrenceEndDate
    )
    dateDisplay = recurrence || 'Recurring event'
  } else {
    dateDisplay = new Date(submission.startDate).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const eventUrl = submission.isRecurring
    ? siteUrl // For recurring events, link to homepage
    : `${siteUrl}/events/${event.id}`

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 0;
    }
    .header {
      background-color: #f97316;
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 20px;
    }
    .event-title {
      font-size: 22px;
      font-weight: 700;
      color: #1c1917;
      margin: 20px 0;
    }
    .section {
      margin: 20px 0;
      padding: 15px;
      background: #fafaf9;
      border-left: 4px solid #f97316;
      border-radius: 4px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #57534e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 12px 0;
    }
    .cta-button {
      display: inline-block;
      margin: 30px 0;
      padding: 14px 28px;
      background: #f97316;
      color: white !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
    }
    .cta-button:hover {
      background: #ea580c;
    }
    .footer {
      margin-top: 30px;
      padding: 20px;
      background: #f5f5f4;
      border-top: 2px solid #e7e5e4;
      font-size: 12px;
      color: #78716c;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎉 Your Event is Live!</h1>
  </div>

  <div class="content">
    <p>Great news! Your event has been approved and is now live on Nyack Today.</p>

    <div class="event-title">${escapeHtml(submission.title)}</div>

    <div class="section">
      <div>${dateDisplay}</div>
      <div style="margin-top: 8px;">📍 ${escapeHtml(submission.venue)}</div>
    </div>

    <div style="text-align: center;">
      <a href="${eventUrl}" class="cta-button">
        ${submission.isRecurring ? 'View Nyack Today' : 'View Your Event on Nyack Today'}
      </a>
    </div>

    <div class="section">
      <div class="section-title">Share Your Event</div>
      <p style="margin: 0;">Help spread the word! Share the link above with friends, family, and on social media.</p>
    </div>

    <p>Thank you for contributing to the Nyack community! We appreciate you helping locals discover great things to do.</p>
  </div>

  <div class="footer">
    <div><strong>Event ID:</strong> ${event.id}</div>
    <div><strong>Approved:</strong> ${approvedAt}</div>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Generate plain text email for submission approval
 */
function generateApprovalPlainTextEmail(
  submission: EventSubmission,
  event: Event
): string {
  const approvedAt = new Date(submission.reviewedAt || new Date()).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  // Format date/time or recurrence pattern
  let dateDisplay: string
  if (submission.isRecurring) {
    const recurrence = formatRecurrencePattern(
      submission.isRecurring,
      submission.recurrenceDays,
      submission.recurrenceEndDate
    )
    dateDisplay = recurrence || 'Recurring event'
  } else {
    dateDisplay = new Date(submission.startDate).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const eventUrl = submission.isRecurring
    ? siteUrl
    : `${siteUrl}/events/${event.id}`

  return `
YOUR EVENT IS LIVE!
===================

Great news! Your event has been approved and is now live on Nyack Today.

${submission.title}
${dateDisplay}
${submission.venue}

${submission.isRecurring ? 'VIEW NYACK TODAY' : 'VIEW YOUR EVENT'}
${eventUrl}

SHARE YOUR EVENT
----------------
Help spread the word! Share the link above with friends, family, and on social media.

Thank you for contributing to the Nyack community! We appreciate you helping locals discover great things to do.

Event ID: ${event.id}
Approved: ${approvedAt}
  `.trim()
}

/**
 * Send approval email to submitter when event is approved
 * Includes link to live event on the site
 */
export async function sendSubmissionApprovalEmail(
  submission: EventSubmission,
  event: Event
): Promise<void> {
  // Validate environment variables
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    console.warn('Approval email skipped: RESEND_API_KEY not configured')
    return
  }

  try {
    const resend = new Resend(apiKey)

    const htmlContent = generateApprovalHtmlEmail(submission, event)
    const textContent = generateApprovalPlainTextEmail(submission, event)

    await resend.emails.send({
      from: 'Nyack Today <submissions@nyacktoday.com>',
      to: submission.submitterEmail,
      subject: `Event Approved! ${submission.title} is now live`,
      html: htmlContent,
      text: textContent,
    })

    console.log(`Approval email sent to: ${submission.submitterEmail}`)
  } catch (error) {
    // Log error but don't throw - email is not critical
    console.error('Failed to send approval email:', error)
  }
}

/**
 * Generate HTML email for submission rejection
 */
function generateRejectionHtmlEmail(submission: EventSubmission): string {
  const reviewedAt = new Date(submission.reviewedAt || new Date()).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  // Format date/time or recurrence pattern
  let dateDisplay: string
  if (submission.isRecurring) {
    const recurrence = formatRecurrencePattern(
      submission.isRecurring,
      submission.recurrenceDays,
      submission.recurrenceEndDate
    )
    dateDisplay = recurrence || 'Recurring event'
  } else {
    dateDisplay = new Date(submission.startDate).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 0;
    }
    .header {
      background-color: #f97316;
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 20px;
    }
    .section {
      margin: 20px 0;
      padding: 15px;
      background: #fafaf9;
      border-left: 4px solid #f97316;
      border-radius: 4px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #57534e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 12px 0;
    }
    .reason-box {
      margin: 20px 0;
      padding: 15px;
      background: #fff7ed;
      border-left: 4px solid #ea580c;
      border-radius: 4px;
    }
    .footer {
      margin-top: 30px;
      padding: 20px;
      background: #f5f5f4;
      border-top: 2px solid #e7e5e4;
      font-size: 12px;
      color: #78716c;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📬 Event Submission Update</h1>
  </div>

  <div class="content">
    <p>Hi there,</p>

    <p>Thank you for taking the time to submit your event to Nyack Today. After reviewing your submission, we've decided not to add it to our calendar at this time.</p>

    <div class="section">
      <div class="section-title">Your Submission</div>
      <div><strong>Title:</strong> ${escapeHtml(submission.title)}</div>
      <div style="margin-top: 8px;"><strong>${submission.isRecurring ? 'Schedule:' : 'Date:'}</strong> ${dateDisplay}</div>
      <div style="margin-top: 8px;"><strong>Venue:</strong> ${escapeHtml(submission.venue)}</div>
    </div>

    ${
      submission.rejectionReason
        ? `
    <div class="reason-box">
      <div class="section-title">Review Notes</div>
      <p style="margin: 0;">${escapeHtml(submission.rejectionReason)}</p>
    </div>
    `
        : ''
    }

    <p>This may be because the event falls outside our geographic focus (Nyack and immediate surrounding areas), doesn't fit our event categories, or we need more information to verify the details.</p>

    <p><strong>Please don't let this discourage you!</strong> We'd love to see future events you're hosting. You can submit another event anytime at ${siteUrl}/submit</p>

    <p>If you have questions or want to discuss this submission, feel free to reply to this email.</p>
  </div>

  <div class="footer">
    <div><strong>Submission ID:</strong> ${submission.id}</div>
    <div><strong>Reviewed:</strong> ${reviewedAt}</div>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Generate plain text email for submission rejection
 */
function generateRejectionPlainTextEmail(submission: EventSubmission): string {
  const reviewedAt = new Date(submission.reviewedAt || new Date()).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  // Format date/time or recurrence pattern
  let dateDisplay: string
  if (submission.isRecurring) {
    const recurrence = formatRecurrencePattern(
      submission.isRecurring,
      submission.recurrenceDays,
      submission.recurrenceEndDate
    )
    dateDisplay = recurrence || 'Recurring event'
  } else {
    dateDisplay = new Date(submission.startDate).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  return `
EVENT SUBMISSION UPDATE
=======================

Hi there,

Thank you for taking the time to submit your event to Nyack Today. After reviewing your submission, we've decided not to add it to our calendar at this time.

YOUR SUBMISSION
---------------
Title: ${submission.title}
${submission.isRecurring ? 'Schedule:' : 'Date:'} ${dateDisplay}
Venue: ${submission.venue}

${
    submission.rejectionReason
      ? `
REVIEW NOTES
------------
${submission.rejectionReason}

`
      : ''
  }
This may be because the event falls outside our geographic focus (Nyack and immediate surrounding areas), doesn't fit our event categories, or we need more information to verify the details.

Please don't let this discourage you! We'd love to see future events you're hosting. You can submit another event anytime at ${siteUrl}/submit

If you have questions or want to discuss this submission, feel free to reply to this email.

Submission ID: ${submission.id}
Reviewed: ${reviewedAt}
  `.trim()
}

// ─── Weekly Digest Emails ────────────────────────────────────────────────────

function generateWelcomeHtmlEmail(unsubscribeUrl: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0; }
    .header { background-color: #f97316; color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 24px 20px; }
    .section { margin: 20px 0; padding: 15px; background: #fafaf9; border-left: 4px solid #f97316; border-radius: 4px; }
    .cta-button { display: inline-block; margin: 20px 0; padding: 12px 24px; background: #f97316; color: white !important; text-decoration: none; border-radius: 8px; font-weight: 600; }
    .footer { margin-top: 30px; padding: 20px; background: #f5f5f4; border-top: 2px solid #e7e5e4; font-size: 12px; color: #78716c; }
    a { color: #f97316; }
  </style>
</head>
<body>
  <div class="header"><h1>You're in! 🎉</h1></div>
  <div class="content">
    <p>Thanks for subscribing to the <strong>Nyack Today weekly digest</strong>.</p>
    <div class="section">
      Every <strong>Thursday morning</strong> you'll get a quick roundup of what's happening in Nyack and the surrounding area — this weekend and beyond.
    </div>
    <p>In the meantime, check out what's happening right now:</p>
    <div style="text-align: center;">
      <a href="${siteUrl}" class="cta-button">Browse Events</a>
    </div>
  </div>
  <div class="footer">
    <div>Nyack Today &middot; <a href="${siteUrl}">${siteUrl.replace(/^https?:\/\//, '')}</a></div>
    <div style="margin-top: 8px;"><a href="${unsubscribeUrl}" style="color: #78716c;">Unsubscribe</a></div>
  </div>
</body>
</html>`.trim()
}

function generateWelcomePlainTextEmail(unsubscribeUrl: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return `
YOU'RE SUBSCRIBED!
==================

Thanks for subscribing to the Nyack Today weekly digest.

Every Thursday morning you'll get a quick roundup of what's happening in Nyack and the surrounding area — this weekend and beyond.

Browse events now: ${siteUrl}

---
Unsubscribe: ${unsubscribeUrl}
`.trim()
}

export async function sendWelcomeEmail(email: string, unsubscribeToken: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('Welcome email skipped: RESEND_API_KEY not configured')
    return
  }
  try {
    const resend = new Resend(apiKey)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const unsubscribeUrl = `${siteUrl}/api/unsubscribe?token=${unsubscribeToken}`
    await resend.emails.send({
      from: 'Nyack Today <submissions@nyacktoday.com>',
      to: email,
      subject: "You're subscribed to the Nyack Today weekly digest!",
      html: generateWelcomeHtmlEmail(unsubscribeUrl),
      text: generateWelcomePlainTextEmail(unsubscribeUrl),
    })
    console.log(`Welcome email sent to: ${email}`)
  } catch (error) {
    console.error('Failed to send welcome email:', error)
  }
}

export function generateDigestHtml(
  events: Event[],
  aiSummary: string,
  unsubscribeUrl: string,
  weekLabel: string
): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  const formatEventDate = (date: Date) =>
    new Date(date).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York',
    })

  const eventRows = events.length === 0
    ? `<p style="color: #57534e; font-style: italic;">No events found this week — check back next Thursday!</p>`
    : events.map((e, i) => `
      ${i > 0 ? '<hr style="border: none; border-top: 1px solid #e7e5e4; margin: 12px 0;">' : ''}
      <div style="padding: 4px 0;">
        <div style="margin-bottom: 4px;">
          <a href="${escapeHtml(e.sourceUrl)}" style="color: #f97316; font-weight: 600; text-decoration: underline; font-size: 16px;">${escapeHtml(e.title)}</a>
          ${e.isFree ? '<span style="margin-left: 8px; background: #dcfce7; color: #166534; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; display: inline-block;">FREE</span>' : ''}
        </div>
        <div style="color: #57534e; font-size: 14px;">${formatEventDate(e.startDate)}</div>
        <div style="color: #78716c; font-size: 14px;">${escapeHtml(e.venue)}</div>
      </div>`).join('')

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1c1917; max-width: 600px; margin: 0 auto; padding: 0; }
    a { color: #f97316; }
  </style>
</head>
<body>
  <div style="background-color: #f97316; color: white; padding: 30px 20px; text-align: center;">
    <div style="font-size: 13px; font-weight: 500; opacity: 0.85; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px;">Nyack Today</div>
    <h1 style="margin: 0; font-size: 26px; font-weight: 700;">Nyack This Week</h1>
    <div style="font-size: 15px; margin-top: 6px; opacity: 0.9;">${escapeHtml(weekLabel)}</div>
  </div>

  <div style="padding: 24px 20px;">
    <div style="background: #fafaf9; border-left: 4px solid #f97316; border-radius: 4px; padding: 16px; margin-bottom: 24px; color: #44403c; font-size: 15px; line-height: 1.7;">
      ${escapeHtml(aiSummary)}
    </div>

    <h2 style="font-size: 18px; font-weight: 700; color: #1c1917; margin: 0 0 16px 0;">Upcoming Events</h2>
    ${eventRows}

    <div style="text-align: center; margin-top: 28px;">
      <a href="${siteUrl}" style="display: inline-block; padding: 12px 28px; background: #f97316; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">See All Events</a>
    </div>
  </div>

  <div style="margin-top: 20px; padding: 20px; background: #f5f5f4; border-top: 2px solid #e7e5e4; font-size: 12px; color: #78716c; text-align: center;">
    <div><strong>Nyack Today</strong> &middot; <a href="${siteUrl}" style="color: #78716c;">${siteUrl.replace(/^https?:\/\//, '')}</a></div>
    <div style="margin-top: 6px;">You're receiving this because you subscribed at Nyack Today.</div>
    <div style="margin-top: 6px;"><a href="${unsubscribeUrl}" style="color: #78716c;">Unsubscribe</a></div>
  </div>
</body>
</html>`.trim()
}

export function generateDigestText(
  events: Event[],
  aiSummary: string,
  unsubscribeUrl: string,
  weekLabel: string
): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const formatEventDate = (date: Date) =>
    new Date(date).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
    })

  const eventLines = events.length === 0
    ? 'No events found this week — check back next Thursday!'
    : events.map(e =>
        `${e.title}${e.isFree ? ' [FREE]' : ''}\n${formatEventDate(e.startDate)} · ${e.venue}\n${e.sourceUrl}`
      ).join('\n\n')

  return `
NYACK THIS WEEK — ${weekLabel.toUpperCase()}
${'='.repeat(40)}

${aiSummary}

UPCOMING EVENTS
---------------
${eventLines}

See all events: ${siteUrl}

---
You're receiving this because you subscribed at Nyack Today.
Unsubscribe: ${unsubscribeUrl}
`.trim()
}

/**
 * Send rejection email to submitter when event is rejected
 * Includes optional reason from admin
 */
export async function sendSubmissionRejectionEmail(
  submission: EventSubmission
): Promise<void> {
  // Validate environment variables
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    console.warn('Rejection email skipped: RESEND_API_KEY not configured')
    return
  }

  try {
    const resend = new Resend(apiKey)

    const htmlContent = generateRejectionHtmlEmail(submission)
    const textContent = generateRejectionPlainTextEmail(submission)

    await resend.emails.send({
      from: 'Nyack Today <submissions@nyacktoday.com>',
      to: submission.submitterEmail,
      subject: `Event Submission Update - ${submission.title}`,
      html: htmlContent,
      text: textContent,
    })

    console.log(`Rejection email sent to: ${submission.submitterEmail}`)
  } catch (error) {
    // Log error but don't throw - email is not critical
    console.error('Failed to send rejection email:', error)
  }
}
