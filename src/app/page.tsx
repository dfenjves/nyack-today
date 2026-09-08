import { Metadata } from 'next'
import HomeClient from './HomeClient'
import { queryEvents, EventQueryOptions } from '@/lib/utils/events-query'
import { Category, Event } from '@prisma/client'
import { DateFilter } from '@/lib/utils/dates'
import { Filters } from '@/components/FilterBar'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
}

interface HomePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

// The date tab, category, price, location, and family-friendly filters all live in the
// URL so that navigating to an event and back restores exactly the view the user had,
// instead of resetting to tonight's default.
export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams

  const dateParam = firstValue(params.date) as DateFilter | undefined
  const customDateParam = firstValue(params.customDate)
  const categoryParam = firstValue(params.category) as Category | undefined
  const free = firstValue(params.free) === 'true'
  const familyFriendly = firstValue(params.familyFriendly) === 'true'
  const nyackOnly = firstValue(params.nyackOnly) === 'true'
  const nearbyOnly = firstValue(params.nearbyOnly) === 'true'

  const baseQueryOptions: EventQueryOptions = {
    category: categoryParam ?? null,
    free,
    familyFriendly,
    nyackOnly,
    nearbyOnly,
  }

  const initialFilters: Filters = {
    category: categoryParam ?? 'ALL',
    priceFilter: free ? 'free' : 'all',
    location: nyackOnly ? 'nyack' : nearbyOnly ? 'nearby' : 'all',
    familyFriendly,
  }

  let initialEvents: Event[]
  let initialDateFilter: DateFilter
  let initialCustomDate: string | null = null
  let initialShowFallback = false

  if (dateParam === 'custom' && customDateParam) {
    initialCustomDate = customDateParam
    initialDateFilter = 'tonight'
    initialEvents = await queryEvents({
      ...baseQueryOptions,
      dateFilter: 'custom',
      customDate: new Date(customDateParam),
    }).catch((): Event[] => [])
  } else {
    const requestedFilter: DateFilter = dateParam ?? 'tonight'

    if (requestedFilter === 'tonight') {
      // Mirror the client-side fallback: if tonight is empty, show this week instead
      const tonightEvents = await queryEvents({ ...baseQueryOptions, dateFilter: 'tonight' }).catch((): Event[] => [])

      if (tonightEvents.length === 0) {
        initialEvents = await queryEvents({ ...baseQueryOptions, dateFilter: 'week' }).catch((): Event[] => [])
        initialDateFilter = 'week'
        initialShowFallback = true
      } else {
        initialEvents = tonightEvents
        initialDateFilter = 'tonight'
      }
    } else {
      initialEvents = await queryEvents({ ...baseQueryOptions, dateFilter: requestedFilter }).catch((): Event[] => [])
      initialDateFilter = requestedFilter
    }
  }

  return (
    <HomeClient
      initialEvents={initialEvents}
      initialDateFilter={initialDateFilter}
      initialCustomDate={initialCustomDate}
      initialFilters={initialFilters}
      initialShowFallback={initialShowFallback}
    />
  )
}
