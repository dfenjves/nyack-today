/**
 * Print a page exactly as the generic scraper sees it: raw HTML matches,
 * or the reduced readable text with --text.
 *
 *   npx tsx scripts/peek-page.ts <url> [--text] [--grep=<regex>] [--limit=N]
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })

import { htmlToReadableText } from '../src/lib/scrapers/generic'

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 NyackToday/1.0 (+https://nyacktoday.com)'

async function main() {
  const url = process.argv[2]
  if (!url) {
    console.error('Usage: npx tsx scripts/peek-page.ts <url> [--text] [--grep=<regex>] [--limit=N]')
    process.exit(1)
  }

  const wantText = process.argv.includes('--text')
  const grepArg = process.argv.find((a) => a.startsWith('--grep='))?.slice(7)
  const limit = parseInt(process.argv.find((a) => a.startsWith('--limit='))?.slice(8) ?? '80', 10)

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  })
  console.log(`HTTP ${response.status} ${response.statusText} — ${response.headers.get('content-type')}`)
  const html = await response.text()
  console.log(`bytes: ${html.length}`)

  const body = wantText ? htmlToReadableText(html, url) : html

  if (grepArg) {
    const regex = new RegExp(grepArg, 'gi')
    const lines = body.split('\n')
    let shown = 0
    for (const line of lines) {
      if (regex.test(line)) {
        console.log(line.trim().slice(0, 400))
        if (++shown >= limit) break
      }
      regex.lastIndex = 0
    }
    if (shown === 0) console.log('(no matches)')
    return
  }

  console.log(body.split('\n').slice(0, limit).join('\n'))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
