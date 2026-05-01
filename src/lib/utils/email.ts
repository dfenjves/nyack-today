import { Resend } from 'resend'
import { Event, EventSubmission } from '@prisma/client'
import { categoryLabels, categoryIcons } from './categories'

// ─── Design System Tokens ────────────────────────────────────────────────────
const DS = {
  forest:  '#1E3A2F',
  deep:    '#2C5240',
  terra:   '#D4622A',
  harvest: '#C8973A',
  oat:     '#F5F0E8',
  surface: '#FDF8F0',
  ink:     '#1A1A14',
  muted:   '#7A7468',
  sand:    '#DDD6C6',
  sage:    '#8FBD9E',
  cream:   '#FEF0E6',
}

// ─── Shared Layout Helpers ────────────────────────────────────────────────────

function emailShell(headerContent: string, bodyContent: string, footerContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      line-height: 1.6;
      color: ${DS.ink};
      background-color: ${DS.oat};
      margin: 0;
      padding: 0;
    }
    .wrapper {
      max-width: 600px;
      margin: 0 auto;
      background-color: ${DS.oat};
    }
    a { color: ${DS.terra}; }
  </style>
</head>
<body>
  <div class="wrapper">
    ${headerContent}
    ${bodyContent}
    ${footerContent}
  </div>
</body>
</html>`
}

function emailHeader(title: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return `
  <div style="background-color: ${DS.forest}; padding: 28px 24px 24px;">
    <div style="font-size: 11px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: ${DS.sage}; margin-bottom: 10px;">
      <a href="${siteUrl}" style="color: ${DS.sage}; text-decoration: none;">Nyack Today</a>
    </div>
    <div style="font-size: 22px; font-weight: 700; color: ${DS.oat}; line-height: 1.2;">${title}</div>
  </div>`
}

function emailFooter(extra?: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return `
  <div style="margin-top: 0; padding: 20px 24px; background-color: ${DS.deep}; font-size: 12px; color: ${DS.sage}; text-align: center;">
    <div><strong style="color: ${DS.oat};">Nyack Today</strong> &middot; <a href="${siteUrl}" style="color: ${DS.sage};">${siteUrl.replace(/^https?:\/\//, '')}</a></div>
    ${extra ? `<div style="margin-top: 8px;">${extra}</div>` : ''}
  </div>`
}

function emailSection(content: string): string {
  return `
  <div style="margin: 0 24px 16px; padding: 16px; background: ${DS.surface}; border-left: 3px solid ${DS.terra}; border-radius: 0 6px 6px 0;">
    ${content}
  </div>`
}

function emailSectionTitle(title: string): string {
  return `<div style="font-size: 10px; font-weight: 600; color: ${DS.muted}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 12px;">${title}</div>`
}

function emailField(label: string, value: string): string {
  return `<div style="margin-bottom: 10px;"><span style="font-weight: 600; color: ${DS.muted};">${label}</span> <span style="color: ${DS.ink};">${value}</span></div>`
}

function emailCtaButton(href: string, label: string): string {
  return `
  <div style="text-align: center; margin: 24px 0;">
    <a href="${href}" style="display: inline-block; padding: 13px 28px; background: ${DS.terra}; color: ${DS.cream} !important; text-decoration: none; border-radius: 20px; font-weight: 600; font-size: 14px;">${label}</a>
  </div>`
}

// ─── Submission Email (to admin) ──────────────────────────────────────────────

function generateHtmlEmail(submission: EventSubmission): string {
  const categoryLabel = categoryLabels[submission.category]
  const categoryIcon = categoryIcons[submission.category]

  const startDate = new Date(submission.startDate).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  })
  const endDate = submission.endDate
    ? new Date(submission.endDate).toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
      })
    : null
  const submittedAt = new Date(submission.submittedAt).toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  })
  const priceDisplay = submission.isFree ? 'Free' : submission.price || 'Not specified'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  const body = `
  <div style="padding: 24px 24px 0;">
    <div style="font-size: 20px; font-weight: 700; color: ${DS.ink}; margin-bottom: 20px;">${escapeHtml(submission.title)}</div>
  </div>

  ${emailSection(`
    ${emailSectionTitle('Required Information')}
    ${emailField('Start:', startDate)}
    ${endDate ? emailField('End:', endDate) : ''}
    ${emailField('Venue:', escapeHtml(submission.venue))}
    ${submission.address ? emailField('Address:', `${escapeHtml(submission.address)}, ${escapeHtml(submission.city)}`) : ''}
    ${emailField('Submitter:', `<a href="mailto:${escapeHtml(submission.submitterEmail)}">${escapeHtml(submission.submitterEmail)}</a>`)}
  `)}

  ${emailSection(`
    ${emailSectionTitle('Additional Details')}
    ${submission.description ? emailField('Description:', escapeHtml(submission.description).replace(/\n/g, '<br>')) : ''}
    ${emailField('Category:', `<span style="background: ${DS.cream}; color: ${DS.terra}; padding: 2px 10px; border-radius: 10px; font-size: 13px; font-weight: 500;">${categoryIcon} ${categoryLabel}</span>`)}
    ${emailField('Price:', escapeHtml(priceDisplay))}
    ${submission.isFamilyFriendly ? emailField('Family-Friendly:', 'Yes') : ''}
    ${submission.sourceUrl ? emailField('Event URL:', `<a href="${escapeHtml(submission.sourceUrl)}">${escapeHtml(submission.sourceUrl)}</a>`) : ''}
  `)}

  ${emailCtaButton(`${siteUrl}/admin/submissions`, 'Review in Admin Dashboard')}

  <div style="padding: 0 24px 24px; font-size: 12px; color: ${DS.muted};">
    <div>Submission ID: ${submission.id}</div>
    <div>Submitted: ${submittedAt}</div>
    <div>Status: ${submission.status}</div>
  </div>`

  return emailShell(emailHeader('New Event Submission'), body, emailFooter())
}

// ─── Confirmation Email (to submitter) ────────────────────────────────────────

function generateConfirmationHtmlEmail(submission: EventSubmission): string {
  const submittedAt = new Date(submission.submittedAt).toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  })
  let dateDisplay: string
  if (submission.isRecurring) {
    dateDisplay = formatRecurrencePattern(submission.isRecurring, submission.recurrenceDays, submission.recurrenceEndDate) || 'Recurring event'
  } else {
    dateDisplay = new Date(submission.startDate).toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  }
  const timeDisplay = new Date(submission.startDate).toLocaleString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  })

  const body = `
  <div style="padding: 24px 24px 0; color: ${DS.ink};">
    <p>Hi there!</p>
    <p>Thank you for submitting your event to Nyack Today. We've received your submission and our team will review it shortly.</p>
  </div>

  ${emailSection(`
    ${emailSectionTitle('What You Submitted')}
    ${emailField('Title:', escapeHtml(submission.title))}
    ${emailField(submission.isRecurring ? 'Schedule:' : 'Date:', dateDisplay)}
    ${emailField('Time:', timeDisplay)}
    ${emailField('Venue:', escapeHtml(submission.venue))}
  `)}

  ${emailSection(`
    ${emailSectionTitle('What Happens Next')}
    <ul style="margin: 0; padding-left: 18px; color: ${DS.ink};">
      <li style="margin-bottom: 6px;">Our team will review your submission within 24-48 hours</li>
      <li style="margin-bottom: 6px;">We'll email you when your event is approved or if we need more information</li>
      <li>Once approved, your event will be live on Nyack Today</li>
    </ul>
  `)}

  <div style="padding: 0 24px 24px; color: ${DS.muted}; font-size: 13px;">
    <p>Questions? Reply to this email or contact us at submissions@nyacktoday.com</p>
    <div style="margin-top: 16px; font-size: 12px;">
      <div>Submission ID: ${submission.id}</div>
      <div>Submitted: ${submittedAt}</div>
    </div>
  </div>`

  return emailShell(emailHeader('Submission Received'), body, emailFooter())
}

// ─── Approval Email (to submitter) ───────────────────────────────────────────

function generateApprovalHtmlEmail(submission: EventSubmission, event: Event): string {
  const approvedAt = new Date(submission.reviewedAt || new Date()).toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  })
  let dateDisplay: string
  if (submission.isRecurring) {
    dateDisplay = formatRecurrencePattern(submission.isRecurring, submission.recurrenceDays, submission.recurrenceEndDate) || 'Recurring event'
  } else {
    dateDisplay = new Date(submission.startDate).toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    })
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const eventUrl = submission.isRecurring ? siteUrl : `${siteUrl}/events/${event.id}`

  const body = `
  <div style="padding: 24px 24px 0; color: ${DS.ink};">
    <p>Great news! Your event has been approved and is now live on Nyack Today.</p>
    <div style="font-size: 20px; font-weight: 700; color: ${DS.ink}; margin: 16px 0 4px;">${escapeHtml(submission.title)}</div>
    <div style="color: ${DS.muted}; font-size: 14px; margin-bottom: 4px;">${dateDisplay}</div>
    <div style="color: ${DS.muted}; font-size: 14px;">📍 ${escapeHtml(submission.venue)}</div>
  </div>

  ${emailCtaButton(eventUrl, submission.isRecurring ? 'View Nyack Today' : 'View Your Event')}

  ${emailSection(`
    ${emailSectionTitle('Share Your Event')}
    <p style="margin: 0; color: ${DS.ink};">Help spread the word! Share the link above with friends, family, and on social media.</p>
  `)}

  <div style="padding: 0 24px 24px; color: ${DS.muted}; font-size: 13px;">
    <p>Thank you for contributing to the Nyack community!</p>
    <div style="font-size: 12px; margin-top: 8px;">
      <div>Event ID: ${event.id}</div>
      <div>Approved: ${approvedAt}</div>
    </div>
  </div>`

  return emailShell(emailHeader('Your Event is Live! 🎉'), body, emailFooter())
}

// ─── Rejection Email (to submitter) ──────────────────────────────────────────

function generateRejectionHtmlEmail(submission: EventSubmission): string {
  const reviewedAt = new Date(submission.reviewedAt || new Date()).toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  })
  let dateDisplay: string
  if (submission.isRecurring) {
    dateDisplay = formatRecurrencePattern(submission.isRecurring, submission.recurrenceDays, submission.recurrenceEndDate) || 'Recurring event'
  } else {
    dateDisplay = new Date(submission.startDate).toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  const body = `
  <div style="padding: 24px 24px 0; color: ${DS.ink};">
    <p>Hi there,</p>
    <p>Thank you for taking the time to submit your event to Nyack Today. After reviewing your submission, we've decided not to add it to our calendar at this time.</p>
  </div>

  ${emailSection(`
    ${emailSectionTitle('Your Submission')}
    ${emailField('Title:', escapeHtml(submission.title))}
    ${emailField(submission.isRecurring ? 'Schedule:' : 'Date:', dateDisplay)}
    ${emailField('Venue:', escapeHtml(submission.venue))}
  `)}

  ${submission.rejectionReason ? `
  <div style="margin: 0 24px 16px; padding: 16px; background: ${DS.cream}; border-left: 3px solid ${DS.harvest}; border-radius: 0 6px 6px 0;">
    ${emailSectionTitle('Review Notes')}
    <p style="margin: 0; color: ${DS.ink};">${escapeHtml(submission.rejectionReason)}</p>
  </div>` : ''}

  <div style="padding: 0 24px 24px; color: ${DS.ink}; font-size: 14px;">
    <p>This may be because the event falls outside our geographic focus, doesn't fit our event categories, or we need more information to verify the details.</p>
    <p><strong>Please don't let this discourage you!</strong> You can submit another event anytime at <a href="${siteUrl}/submit">${siteUrl}/submit</a></p>
    <p>If you have questions, feel free to reply to this email.</p>
    <div style="font-size: 12px; color: ${DS.muted}; margin-top: 16px;">
      <div>Submission ID: ${submission.id}</div>
      <div>Reviewed: ${reviewedAt}</div>
    </div>
  </div>`

  return emailShell(emailHeader('Event Submission Update'), body, emailFooter())
}

// ─── Welcome Email ────────────────────────────────────────────────────────────

function generateWelcomeHtmlEmail(unsubscribeUrl: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  const body = `
  <div style="padding: 24px 24px 0; color: ${DS.ink};">
    <p>Thanks for subscribing to the <strong>Nyack Today weekly digest</strong>.</p>
  </div>

  ${emailSection(`
    Every <strong>Thursday morning</strong> you'll get a quick roundup of what's happening in Nyack and the surrounding area — this weekend and beyond.
  `)}

  <div style="padding: 0 24px 8px; color: ${DS.ink}; font-size: 14px;">
    <p>In the meantime, check out what's happening right now:</p>
  </div>

  ${emailCtaButton(siteUrl, 'Browse Events')}
  `

  return emailShell(
    emailHeader("You're in! 🎉"),
    body,
    emailFooter(`<a href="${unsubscribeUrl}" style="color: ${DS.sage};">Unsubscribe</a>`)
  )
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

// ─── Weekly Digest ────────────────────────────────────────────────────────────

export function generateDigestHtml(
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

  const eventRows = events.length === 0
    ? `<p style="color: ${DS.muted}; font-style: italic;">No events found this week — check back next Thursday!</p>`
    : events.map((e, i) => `
      ${i > 0 ? `<hr style="border: none; border-top: 1px solid ${DS.sand}; margin: 14px 0;">` : ''}
      <div style="padding: 4px 0;">
        <div style="margin-bottom: 4px;">
          <a href="${escapeHtml(e.sourceUrl)}" style="color: ${DS.terra}; font-weight: 600; text-decoration: underline; font-size: 15px;">${escapeHtml(e.title)}</a>
          ${e.isFree ? `<span style="margin-left: 8px; background: #E8EFE0; color: ${DS.forest}; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 10px; display: inline-block; text-transform: uppercase; letter-spacing: 0.06em;">Free</span>` : ''}
        </div>
        <div style="color: ${DS.muted}; font-size: 13px; margin-top: 2px;">${formatEventDate(e.startDate)}</div>
        <div style="color: ${DS.muted}; font-size: 13px;">${escapeHtml(e.venue)}</div>
      </div>`).join('')

  const header = `
  <div style="background-color: ${DS.forest}; padding: 28px 24px 24px; position: relative;">
    <div style="font-size: 11px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: ${DS.sage}; margin-bottom: 10px;">
      <a href="${siteUrl}" style="color: ${DS.sage}; text-decoration: none;">Nyack Today</a>
    </div>
    <div style="font-size: 24px; font-weight: 700; color: ${DS.oat}; line-height: 1.2; margin-bottom: 6px;">Nyack This Week</div>
    <div style="font-size: 14px; color: ${DS.sage};">${escapeHtml(weekLabel)}</div>
  </div>`

  const body = `
  <div style="padding: 24px 24px 0;">
    <div style="background: ${DS.surface}; border-left: 3px solid ${DS.terra}; border-radius: 0 6px 6px 0; padding: 16px; margin-bottom: 24px; color: ${DS.ink}; font-size: 15px; line-height: 1.7;">
      ${escapeHtml(aiSummary)}
    </div>

    <h2 style="font-size: 11px; font-weight: 600; color: ${DS.muted}; text-transform: uppercase; letter-spacing: 0.12em; margin: 0 0 16px 0;">Upcoming Events</h2>
    ${eventRows}
  </div>

  ${emailCtaButton(siteUrl, 'See All Events')}`

  const footer = `
  <div style="margin-top: 0; padding: 20px 24px; background-color: ${DS.deep}; font-size: 12px; color: ${DS.sage}; text-align: center;">
    <div><strong style="color: ${DS.oat};">Nyack Today</strong> &middot; <a href="${siteUrl}" style="color: ${DS.sage};">${siteUrl.replace(/^https?:\/\//, '')}</a></div>
    <div style="margin-top: 6px;">You're receiving this because you subscribed at Nyack Today.</div>
    <div style="margin-top: 6px;"><a href="${unsubscribeUrl}" style="color: ${DS.sage};">Unsubscribe</a></div>
  </div>`

  return emailShell(header, body, footer)
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

// ─── Send Functions ───────────────────────────────────────────────────────────

export async function sendEventSubmissionEmail(submission: EventSubmission): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const adminEmail = process.env.ADMIN_EMAIL
  if (!apiKey || !adminEmail) {
    console.warn('Email notification skipped: RESEND_API_KEY or ADMIN_EMAIL not configured')
    return
  }
  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from: 'Nyack Today <submissions@nyacktoday.com>',
      to: adminEmail,
      subject: `New Event Submission: ${submission.title}`,
      html: generateHtmlEmail(submission),
      text: generatePlainTextEmail(submission),
    })
    console.log(`Event submission email sent for: ${submission.title}`)
  } catch (error) {
    console.error('Failed to send event submission email:', error)
  }
}

export async function sendSubmissionConfirmationEmail(submission: EventSubmission): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('Confirmation email skipped: RESEND_API_KEY not configured')
    return
  }
  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from: 'Nyack Today <submissions@nyacktoday.com>',
      to: submission.submitterEmail,
      subject: `Event Submission Received - ${submission.title}`,
      html: generateConfirmationHtmlEmail(submission),
      text: generateConfirmationPlainTextEmail(submission),
    })
    console.log(`Confirmation email sent to: ${submission.submitterEmail}`)
  } catch (error) {
    console.error('Failed to send confirmation email:', error)
  }
}

export async function sendSubmissionApprovalEmail(submission: EventSubmission, event: Event): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('Approval email skipped: RESEND_API_KEY not configured')
    return
  }
  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from: 'Nyack Today <submissions@nyacktoday.com>',
      to: submission.submitterEmail,
      subject: `Event Approved! ${submission.title} is now live`,
      html: generateApprovalHtmlEmail(submission, event),
      text: generateApprovalPlainTextEmail(submission, event),
    })
    console.log(`Approval email sent to: ${submission.submitterEmail}`)
  } catch (error) {
    console.error('Failed to send approval email:', error)
  }
}

export async function sendSubmissionRejectionEmail(submission: EventSubmission): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('Rejection email skipped: RESEND_API_KEY not configured')
    return
  }
  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from: 'Nyack Today <submissions@nyacktoday.com>',
      to: submission.submitterEmail,
      subject: `Event Submission Update - ${submission.title}`,
      html: generateRejectionHtmlEmail(submission),
      text: generateRejectionPlainTextEmail(submission),
    })
    console.log(`Rejection email sent to: ${submission.submitterEmail}`)
  } catch (error) {
    console.error('Failed to send rejection email:', error)
  }
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

// ─── Plain Text Emails ────────────────────────────────────────────────────────

function generatePlainTextEmail(submission: EventSubmission): string {
  const categoryLabel = categoryLabels[submission.category]
  const categoryIcon = categoryIcons[submission.category]
  const startDate = new Date(submission.startDate).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  })
  const endDate = submission.endDate
    ? new Date(submission.endDate).toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
      })
    : null
  const submittedAt = new Date(submission.submittedAt).toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  })
  const priceDisplay = submission.isFree ? 'Free' : submission.price || 'Not specified'

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

function generateConfirmationPlainTextEmail(submission: EventSubmission): string {
  const submittedAt = new Date(submission.submittedAt).toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  })
  let dateDisplay: string
  if (submission.isRecurring) {
    dateDisplay = formatRecurrencePattern(submission.isRecurring, submission.recurrenceDays, submission.recurrenceEndDate) || 'Recurring event'
  } else {
    dateDisplay = new Date(submission.startDate).toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  }
  const timeDisplay = new Date(submission.startDate).toLocaleString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  })

  return `
EVENT SUBMISSION RECEIVED
=========================

Hi there!

Thank you for submitting your event to Nyack Today.

WHAT YOU SUBMITTED
------------------
Title: ${submission.title}
${submission.isRecurring ? 'Schedule:' : 'Date:'} ${dateDisplay}
Time: ${timeDisplay}
Venue: ${submission.venue}

WHAT HAPPENS NEXT
------------------
- Our team will review your submission within 24-48 hours
- We'll email you when your event is approved
- Once approved, your event will be live on Nyack Today

Questions? Reply to this email or contact us at submissions@nyacktoday.com

Submission ID: ${submission.id}
Submitted: ${submittedAt}
  `.trim()
}

function generateApprovalPlainTextEmail(submission: EventSubmission, event: Event): string {
  const approvedAt = new Date(submission.reviewedAt || new Date()).toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  })
  let dateDisplay: string
  if (submission.isRecurring) {
    dateDisplay = formatRecurrencePattern(submission.isRecurring, submission.recurrenceDays, submission.recurrenceEndDate) || 'Recurring event'
  } else {
    dateDisplay = new Date(submission.startDate).toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    })
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const eventUrl = submission.isRecurring ? siteUrl : `${siteUrl}/events/${event.id}`

  return `
YOUR EVENT IS LIVE!
===================

Great news! Your event has been approved and is now live on Nyack Today.

${submission.title}
${dateDisplay}
${submission.venue}

${submission.isRecurring ? 'VIEW NYACK TODAY' : 'VIEW YOUR EVENT'}
${eventUrl}

Thank you for contributing to the Nyack community!

Event ID: ${event.id}
Approved: ${approvedAt}
  `.trim()
}

function generateRejectionPlainTextEmail(submission: EventSubmission): string {
  const reviewedAt = new Date(submission.reviewedAt || new Date()).toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  })
  let dateDisplay: string
  if (submission.isRecurring) {
    dateDisplay = formatRecurrencePattern(submission.isRecurring, submission.recurrenceDays, submission.recurrenceEndDate) || 'Recurring event'
  } else {
    dateDisplay = new Date(submission.startDate).toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  return `
EVENT SUBMISSION UPDATE
=======================

Hi there,

Thank you for submitting your event to Nyack Today. After reviewing, we've decided not to add it to our calendar at this time.

YOUR SUBMISSION
---------------
Title: ${submission.title}
${submission.isRecurring ? 'Schedule:' : 'Date:'} ${dateDisplay}
Venue: ${submission.venue}

${submission.rejectionReason ? `REVIEW NOTES\n------------\n${submission.rejectionReason}\n\n` : ''}You can submit another event anytime at ${siteUrl}/submit

Submission ID: ${submission.id}
Reviewed: ${reviewedAt}
  `.trim()
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (char) => map[char])
}

function formatRecurrencePattern(
  isRecurring: boolean,
  recurrenceDays: number[],
  recurrenceEndDate: Date | null
): string {
  if (!isRecurring || !recurrenceDays || recurrenceDays.length === 0) return ''
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const days = recurrenceDays.map((d) => dayNames[d]).join(', ')
  if (recurrenceEndDate) {
    const endDateStr = new Date(recurrenceEndDate).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    })
    return `Repeats every ${days} until ${endDateStr}`
  }
  return `Repeats every ${days}`
}
