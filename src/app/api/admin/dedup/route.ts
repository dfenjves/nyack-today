import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Event } from '@prisma/client'
import { findDuplicateGroups, buildMergedEventData } from '@/lib/dedup'

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    // Default to dryRun=true for safety — require explicit ?dryRun=false to mutate
    const dryRun = searchParams.get('dryRun') !== 'false'

    const now = new Date()
    const events = await prisma.event.findMany({
      where: {
        startDate: { gte: now },
        isHidden: false,
        isRecurring: false,
      },
      orderBy: { startDate: 'asc' },
    })

    const groups = findDuplicateGroups(events)

    let eventsDeleted = 0
    let eventsUpdated = 0

    if (!dryRun) {
      for (const group of groups) {
        await prisma.$transaction(async (tx) => {
          // Accumulate merged updates across all losers cumulatively
          const accumulatedUpdates: Partial<Event> = {}
          for (const loser of group.losers) {
            const loserUpdates = buildMergedEventData(
              { ...group.winner, ...accumulatedUpdates } as Event,
              loser
            )
            Object.assign(accumulatedUpdates, loserUpdates)
          }

          if (Object.keys(accumulatedUpdates).length > 0) {
            await tx.event.update({
              where: { id: group.winner.id },
              data: accumulatedUpdates,
            })
            eventsUpdated++
          }

          for (const loser of group.losers) {
            await tx.event.delete({ where: { id: loser.id } })
            eventsDeleted++
          }
        })
      }
    }

    return NextResponse.json({
      dryRun,
      groupsFound: groups.length,
      eventsDeleted,
      eventsUpdated,
      groups: groups.map(group => ({
        winner: {
          id: group.winner.id,
          title: group.winner.title,
          venue: group.winner.venue,
          startDate: group.winner.startDate,
          sourceName: group.winner.sourceName,
          sourceUrl: group.winner.sourceUrl,
        },
        losers: group.losers.map(l => ({
          id: l.id,
          title: l.title,
          venue: l.venue,
          startDate: l.startDate,
          sourceName: l.sourceName,
          sourceUrl: l.sourceUrl,
        })),
        similarity: group.similarity,
      })),
    })
  } catch (error) {
    console.error('Dedup API error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Dedup scan failed', message }, { status: 500 })
  }
}
