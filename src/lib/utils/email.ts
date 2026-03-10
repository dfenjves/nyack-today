import { Resend } from 'resend'
import { EventSubmission } from '@prisma/client'
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
