import { Event } from '@prisma/client'
import EventCard from './EventCard'

interface EventListProps {
  events: Event[]
  showDate?: boolean
  emptyMessage?: string
}

export default function EventList({
  events,
  showDate = false,
  emptyMessage = "No events found",
}: EventListProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">🌙</div>
        <p className="text-stone-500">{emptyMessage}</p>
        <p className="text-sm text-stone-400 mt-2">
          Check back later or try a different filter
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <EventCard key={event.id} event={event} showDate={showDate} />
      ))}
    </div>
  )
}
