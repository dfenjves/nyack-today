const API_URL = 'https://inffuse.eventscalendar.co/js/v0.1/calendar/data?inffuse-platform=weebly&inffuse-user=75555087&inffuse-site=265976362367589702&inffuse-project=d1a10f1c-037d-4f4a-b104-e0d85da09c41'

async function main() {
  const response = await fetch(API_URL)
  const data = await response.json()

  const events = data?.project?.data?.events || []

  console.log('First 3 events from Inffuse API:')
  console.log('=================================')

  for (const event of events.slice(0, 3)) {
    console.log(`\nTitle: ${event.title}`)
    console.log(`Start timestamp: ${event.start}`)
    console.log(`Start date field: ${event.startDate}`)
    console.log(`Timezone: ${event.timezone}`)
    console.log(`All day: ${event.allday}`)
    console.log(`Date only: ${event.dateonly}`)

    // Show what JavaScript creates from the timestamp
    const jsDate = new Date(event.start)
    console.log(`\nJavaScript Date from timestamp:`)
    console.log(`  toString(): ${jsDate.toString()}`)
    console.log(`  toISOString(): ${jsDate.toISOString()}`)
    console.log(`  toLocaleString('en-US', { timeZone: 'America/New_York' }): ${jsDate.toLocaleString('en-US', { timeZone: 'America/New_York' })}`)
  }
}

main().catch(console.error)
