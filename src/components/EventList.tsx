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
  emptyMessage = 'No events found',
}: EventListProps) {
  if (events.length === 0) {
    return (
      <div
        style={{
          background: '#FDF8F0',
          border: '0.5px dashed #DDD6C6',
          borderRadius: 16,
          padding: 40,
          textAlign: 'center',
          color: '#7A7468',
          fontSize: 13,
        }}
      >
        {emptyMessage}
      </div>
    )
  }

  return (
    <div
      style={{
        background: '#FDF8F0',
        border: '0.5px solid #DDD6C6',
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      {events.map((event, i) => (
        <EventCard
          key={event.id}
          event={event}
          showDate={showDate}
          isLast={i === events.length - 1}
        />
      ))}
    </div>
  )
}
