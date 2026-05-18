import HomeClient from './HomeClient'
import { queryEvents } from '@/lib/utils/events-query'
import { Event } from '@prisma/client'
import { DateFilter } from '@/lib/utils/dates'

export const dynamic = 'force-dynamic'

export default async function Home() {
  // Fetch tonight's events and marquee events in parallel on the server
  const [tonightEvents, marqueeEvents] = await Promise.all([
    queryEvents({ dateFilter: 'tonight' }).catch((): Event[] => []),
    queryEvents({ marqueeOnly: true, limit: 9 }).catch((): Event[] => []),
  ])

  // Mirror the client-side fallback: if tonight is empty, show this week instead
  let initialEvents: Event[]
  let initialDateFilter: DateFilter
  let initialShowFallback: boolean

  if (tonightEvents.length === 0) {
    initialEvents = await queryEvents({ dateFilter: 'week' }).catch((): Event[] => [])
    initialDateFilter = 'week'
    initialShowFallback = true
  } else {
    initialEvents = tonightEvents
    initialDateFilter = 'tonight'
    initialShowFallback = false
  }

  return (
    <HomeClient
      initialEvents={initialEvents}
      initialDateFilter={initialDateFilter}
      initialShowFallback={initialShowFallback}
      initialMarqueeEvents={marqueeEvents}
    />
  )
}
