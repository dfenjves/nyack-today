/**
 * Notification utility for scraper alerts
 *
 * Supports Discord and Slack webhooks via environment variables:
 * - DISCORD_WEBHOOK_URL: Discord webhook for notifications
 * - SLACK_WEBHOOK_URL: Slack webhook for notifications
 */

interface ScraperNotification {
  type: 'success' | 'warning' | 'error'
  title: string
  message: string
  details?: Record<string, string | number>
}

/**
 * Send a notification to configured webhooks
 */
export async function sendNotification(notification: ScraperNotification): Promise<void> {
  const discordUrl = process.env.DISCORD_WEBHOOK_URL
  const slackUrl = process.env.SLACK_WEBHOOK_URL

  const promises: Promise<void>[] = []

  if (discordUrl) {
    promises.push(sendDiscordNotification(discordUrl, notification))
  }

  if (slackUrl) {
    promises.push(sendSlackNotification(slackUrl, notification))
  }

  // If no webhooks configured, just log
  if (promises.length === 0) {
    console.log(`[Notification] ${notification.type.toUpperCase()}: ${notification.title}`)
    console.log(`  ${notification.message}`)
    if (notification.details) {
      console.log('  Details:', notification.details)
    }
    return
  }

  // Send all notifications in parallel, don't fail if one fails
  await Promise.allSettled(promises)
}

/**
 * Send notification to Discord webhook
 */
async function sendDiscordNotification(
  webhookUrl: string,
  notification: ScraperNotification
): Promise<void> {
  const colors = {
    success: 0x22c55e, // green
    warning: 0xeab308, // yellow
    error: 0xef4444, // red
  }

  const embed = {
    title: notification.title,
    description: notification.message,
    color: colors[notification.type],
    timestamp: new Date().toISOString(),
    fields: notification.details
      ? Object.entries(notification.details).map(([name, value]) => ({
          name,
          value: String(value),
          inline: true,
        }))
      : undefined,
    footer: {
      text: 'Nyack Today Scraper',
    },
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    })

    if (!response.ok) {
      console.error('Discord notification failed:', response.status)
    }
  } catch (error) {
    console.error('Failed to send Discord notification:', error)
  }
}

/**
 * Send notification to Slack webhook
 */
async function sendSlackNotification(
  webhookUrl: string,
  notification: ScraperNotification
): Promise<void> {
  const emojis = {
    success: ':white_check_mark:',
    warning: ':warning:',
    error: ':x:',
  }

  const detailsText = notification.details
    ? Object.entries(notification.details)
        .map(([key, value]) => `*${key}:* ${value}`)
        .join(' | ')
    : ''

  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emojis[notification.type]} ${notification.title}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: notification.message,
        },
      },
      ...(detailsText
        ? [
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: detailsText,
                },
              ],
            },
          ]
        : []),
    ],
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      console.error('Slack notification failed:', response.status)
    }
  } catch (error) {
    console.error('Failed to send Slack notification:', error)
  }
}

/**
 * Send scraper completion summary notification
 */
export async function notifyScraperComplete(summary: {
  totalEventsFound: number
  totalEventsAdded: number
  totalEventsUpdated: number
  failedScrapers: string[]
}): Promise<void> {
  const hasFailures = summary.failedScrapers.length > 0

  await sendNotification({
    type: hasFailures ? 'warning' : 'success',
    title: hasFailures ? 'Scraper Run Completed with Errors' : 'Scraper Run Completed',
    message: hasFailures
      ? `Some scrapers failed: ${summary.failedScrapers.join(', ')}`
      : 'All scrapers completed successfully',
    details: {
      'Events Found': summary.totalEventsFound,
      'Events Added': summary.totalEventsAdded,
      'Events Updated': summary.totalEventsUpdated,
      ...(hasFailures ? { 'Failed Scrapers': summary.failedScrapers.length } : {}),
    },
  })
}

/**
 * Send critical error notification
 */
export async function notifyScraperError(error: string): Promise<void> {
  await sendNotification({
    type: 'error',
    title: 'Scraper Critical Error',
    message: `The scraper job failed with an error: ${error}`,
  })
}
