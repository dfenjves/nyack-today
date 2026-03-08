import { exploreRocklandScraper } from '../src/lib/scrapers/explorerockland'

async function main() {
  console.log('Testing Explore Rockland scraper...\n')

  const result = await exploreRocklandScraper.scrape()

  console.log(`Status: ${result.status}`)
  console.log(`Events found: ${result.events.length}`)
  if (result.errorMessage) {
    console.log(`Error: ${result.errorMessage}`)
  }

  if (result.events.length > 0) {
    console.log('\nNyack-area events found:')
    console.log('========================')
    for (const event of result.events) {
      console.log(`\n${event.title}`)
      console.log(`  Venue: ${event.venue}`)
      console.log(`  City: ${event.city}`)
      console.log(`  Address: ${event.address}`)
      console.log(`  Date: ${event.startDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}`)
      console.log(`  Category: ${event.category}`)
      if (event.price) console.log(`  Price: ${event.price}`)
      if (event.isFree) console.log(`  FREE`)
    }
  }
}

main().catch(console.error)
