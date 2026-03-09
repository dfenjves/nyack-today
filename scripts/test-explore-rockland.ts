import * as cheerio from 'cheerio'

const URL = 'https://explorerocklandny.com/events'

async function main() {
  const response = await fetch(URL)
  const html = await response.text()
  const $ = cheerio.load(html)

  // Extract JSON-LD
  const jsonLdScripts = $('script[type="application/ld+json"]')
  console.log(`Found ${jsonLdScripts.length} JSON-LD scripts\n`)

  jsonLdScripts.each((i, script) => {
    try {
      const data = JSON.parse($(script).html() || '')
      console.log(`\n=== JSON-LD Script ${i + 1} ===`)
      console.log(JSON.stringify(data, null, 2).substring(0, 2000))
    } catch (e) {
      console.log(`Failed to parse JSON-LD ${i + 1}`)
    }
  })

  // Check for event list structure
  const eventArticles = $('.tribe-events-calendar-list__event-row')
  console.log(`\n\nFound ${eventArticles.length} event articles`)

  if (eventArticles.length > 0) {
    console.log('\nFirst event structure:')
    const first = eventArticles.first()
    console.log('Title:', first.find('.tribe-events-calendar-list__event-title').text().trim())
    console.log('Date:', first.find('.tribe-events-calendar-list__event-date-tag').text().trim())
    console.log('Venue:', first.find('.tribe-events-calendar-list__event-venue').text().trim())
  }
}

main().catch(console.error)
