import { Event } from '@prisma/client'
import { stringSimilarity, normalizeVenue, normalizeTitle } from './scrapers/utils'

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

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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

  // Within each day, group events by similar venue then check title similarity
  for (const dayEvents of byDate.values()) {
    // Build venue groups
    const venueGroups: Event[][] = []
    for (const event of dayEvents) {
      const normVenue = normalizeVenue(event.venue)
      let placed = false
      for (const group of venueGroups) {
        const repVenue = normalizeVenue(group[0].venue)
        if (stringSimilarity(normVenue, repVenue) >= VENUE_THRESHOLD) {
          group.push(event)
          placed = true
          break
        }
      }
      if (!placed) venueGroups.push([event])
    }

    // Within each venue group, find duplicate title pairs
    for (const group of venueGroups) {
      if (group.length < 2) continue
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i]
          const b = group[j]
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
