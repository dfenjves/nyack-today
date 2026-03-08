import { maureensJazzCellarScraper } from '../src/lib/scrapers/maureensjazzcellar'
import { prisma } from '../src/lib/db'
import { deduplicateAndSave } from '../src/lib/scrapers/utils'

async function main() {
  console.log('Running Maureen\'s Jazz Cellar scraper...\n')

  const result = await maureensJazzCellarScraper.scrape()

  console.log(`Status: ${result.status}`)
  console.log(`Events found: ${result.events.length}`)
  if (result.errorMessage) {
    console.log(`Error: ${result.errorMessage}`)
  }

  if (result.events.length > 0) {
    console.log('\nFirst 5 events:')
    console.log('===============')
    for (const event of result.events.slice(0, 5)) {
      const dayOfWeek = event.startDate.toLocaleDateString('en-US', { weekday: 'long' })
      const dateStr = event.startDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
      console.log(`\n${event.title}`)
      console.log(`  Day: ${dayOfWeek}`)
      console.log(`  Date: ${dateStr}`)
      console.log(`  ISO: ${event.startDate.toISOString()}`)
    }

    console.log('\n\nSaving to database...')
    const saveResult = await deduplicateAndSave(result.events, result.sourceName)
    console.log(`Added: ${saveResult.added}, Updated: ${saveResult.updated}, Duplicate: ${saveResult.duplicate}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
