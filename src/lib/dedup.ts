import { Event } from '@prisma/client'
import { stringSimilarity, normalizeVenue, normalizeTitle } from './scrapers/utils'

const GENERIC_VENUE_NAMES = new Set([
  'nyack', 'south nyack', 'upper nyack', 'west nyack',
  'garnerville', 'piermont', 'tarrytown', 'sleepy hollow',
  'rockland county', 'westchester',
])

function isGenericVenue(venue: string): boolean {
  return GENERIC_VENUE_NAMES.has(normalizeVenue(venue))
}

export interface DuplicateGroup {
  winner: Event
  losers: Event[]
  similarity: {
    titleSimilarity: number
    venueSimilarity: number
  }
}

export function scoreEventCompleteness(event: Event): number {
  let score = 0
  if (event.description && event.description.trim().length > 0) score++
  if (event.endDate) score++
  if (event.address && event.address.trim().length > 0) score++
  if (event.price && event.price.trim().length > 0) score++
  if (event.imageUrl && event.imageUrl.trim().length > 0) score++
  if (event.category !== 'OTHER') score++
  if (event.isMarquee) score += 2
  return score
}

export function buildMergedEventData(winner: Event, loser: Event): Partial<Event> {
  const updates: Partial<Event> = {}
  if (!winner.description && loser.description) updates.description = loser.description
  if (!winner.endDate && loser.endDate) updates.endDate = loser.endDate
  if (!winner.address && loser.address) updates.address = loser.address
  if (!winner.price && loser.price) updates.price = loser.price
  if (!winner.imageUrl && loser.imageUrl) updates.imageUrl = loser.imageUrl
  if (winner.category === 'OTHER' && loser.category !== 'OTHER') updates.category = loser.category
  if (!winner.isFree && loser.isFree) updates.isFree = loser.isFree
  if (!winner.isFamilyFriendly && loser.isFamilyFriendly) updates.isFamilyFriendly = loser.isFamilyFriendly
  if (!winner.isMarquee && loser.isMarquee) updates.isMarquee = loser.isMarquee
  return updates
}

// Bucket by calendar day in Eastern Time, not the server's local timezone —
// the DB stores UTC, so e.g. an 8pm Eastern event is already past midnight UTC
// and would otherwise land in the wrong day's bucket.
const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function toLocalDateStr(d: Date): string {
  return dateKeyFormatter.format(d) // en-CA formats as YYYY-MM-DD
}

// Phrases that identify a recurring, city-wide one-off event type. When two
// events on the same day in the same city both mention the same phrase, treat
// them as duplicate candidates even if the rest of the title differs a lot
// (different sources often give the same street fair a different name each
// time, e.g. "Street Fair Sunday" vs "Fall Fest Street Fair").
const SHARED_EVENT_PHRASES = [
  'street fair',
  'block party',
  'farmers market',
  'sidewalk sale',
  'art walk',
  'wine walk',
  'restaurant week',
  'tree lighting',
  'car show',
]

function sharedEventPhrase(titleA: string, titleB: string): boolean {
  const a = titleA.toLowerCase()
  const b = titleB.toLowerCase()
  return SHARED_EVENT_PHRASES.some(phrase => a.includes(phrase) && b.includes(phrase))
}

export function findDuplicateGroups(events: Event[]): DuplicateGroup[] {
  const VENUE_THRESHOLD = 0.7
  const TITLE_THRESHOLD = 0.75

  // Group by local date
  const byDate = new Map<string, Event[]>()
  for (const event of events) {
    const key = toLocalDateStr(event.startDate)
    const bucket = byDate.get(key) ?? []
    bucket.push(event)
    byDate.set(key, bucket)
  }

  // Union-find for transitive grouping
  const parent = new Map<string, string>()
  for (const event of events) {
    parent.set(event.id, event.id)
  }

  function find(id: string): string {
    if (parent.get(id) !== id) {
      parent.set(id, find(parent.get(id)!))
    }
    return parent.get(id)!
  }

  function union(a: string, b: string) {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(rb, ra)
  }

  // Within each day, compare all pairs of events.
  // Require venue similarity unless at least one event uses a generic city-level venue name.
  for (const dayEvents of byDate.values()) {
    for (let i = 0; i < dayEvents.length; i++) {
      for (let j = i + 1; j < dayEvents.length; j++) {
        const a = dayEvents[i]
        const b = dayEvents[j]

        // Same city + a shared "type of event" phrase (e.g. "street fair") is
        // treated as a duplicate regardless of how different the rest of the
        // title/venue text is — different sources often name these one-offs
        // differently each time.
        if (a.city === b.city && sharedEventPhrase(a.title, b.title)) {
          union(a.id, b.id)
          continue
        }

        const eitherGeneric = isGenericVenue(a.venue) || isGenericVenue(b.venue)
        if (!eitherGeneric) {
          const venueSim = stringSimilarity(normalizeVenue(a.venue), normalizeVenue(b.venue))
          if (venueSim < VENUE_THRESHOLD) continue
        }

        const normA = normalizeTitle(a.title, a.venue)
        const normB = normalizeTitle(b.title, b.venue)
        const titleSim = stringSimilarity(normA, normB)
        const isDuplicate =
          titleSim >= TITLE_THRESHOLD ||
          (normA.length > 0 && normB.length > 0 && (normA.includes(normB) || normB.includes(normA)))
        if (isDuplicate) union(a.id, b.id)
      }
    }
  }

  // Collect union-find groups
  const eventById = new Map(events.map(e => [e.id, e]))
  const rootToMembers = new Map<string, string[]>()
  for (const event of events) {
    const root = find(event.id)
    const members = rootToMembers.get(root) ?? []
    members.push(event.id)
    rootToMembers.set(root, members)
  }

  const groups: DuplicateGroup[] = []
  for (const memberIds of rootToMembers.values()) {
    if (memberIds.length < 2) continue
    const members = memberIds.map(id => eventById.get(id)!).filter(Boolean)

    // Pick winner: highest completeness, tie-break by earliest createdAt
    const sorted = [...members].sort((a, b) => {
      const scoreDiff = scoreEventCompleteness(b) - scoreEventCompleteness(a)
      if (scoreDiff !== 0) return scoreDiff
      return a.createdAt.getTime() - b.createdAt.getTime()
    })

    const winner = sorted[0]
    const losers = sorted.slice(1)

    // Best similarity score across pairs involving winner
    let bestTitleSim = 0
    let bestVenueSim = 0
    for (const loser of losers) {
      const ts = stringSimilarity(normalizeTitle(winner.title, winner.venue), normalizeTitle(loser.title, loser.venue))
      const vs = stringSimilarity(normalizeVenue(winner.venue), normalizeVenue(loser.venue))
      if (ts > bestTitleSim) bestTitleSim = ts
      if (vs > bestVenueSim) bestVenueSim = vs
    }

    groups.push({ winner, losers, similarity: { titleSimilarity: bestTitleSim, venueSimilarity: bestVenueSim } })
  }

  return groups
}
