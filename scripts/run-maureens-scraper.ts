import { maureensJazzCellarScraper } from '../src/lib/scrapers/maureensjazzcellar'
import { runScraper } from '../src/lib/scrapers'

async function main() {
  console.log('Running Maureen\'s Jazz Cellar scraper...\n')

  const result = await runScraper("Maureen's Jazz Cellar")

  if (result) {
    console.log(`Status: ${result.status}`)
    console.log(`Events found: ${result.events.length}`)
    console.log(`Events added: ${result.eventsAdded}`)
    console.log(`Events updated: ${result.eventsUpdated}`)
    console.log(`Duplicates: ${result.eventsDuplicate}`)
    if (result.errorMessage) {
      console.log(`Error: ${result.errorMessage}`)
    }
  }
}

main().catch(console.error)
