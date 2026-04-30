import { Event } from '@prisma/client'
import { formatTime, formatDate } from '@/lib/utils/dates'
import { categoryLabels, categoryHexColors } from '@/lib/utils/categories'
import { decodeHtmlEntities } from '@/lib/utils/text'
import Link from 'next/link'
import CalendarDropdown from './CalendarDropdown'

interface EventCardProps {
  event: Event
  showDate?: boolean
  isLast?: boolean
}

export default function EventCard({ event, showDate = false, isLast = false }: EventCardProps) {
  const startDate = new Date(event.startDate)
  const label = categoryLabels[event.category]
  const dotColor = categoryHexColors[event.category]
  const title = decodeHtmlEntities(event.title)
  const venue = decodeHtmlEntities(event.venue)

  return (
    <Link
      href={event.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group no-underline"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 18px',
        borderBottom: isLast ? 'none' : '0.5px solid #EBE4D4',
        textDecoration: 'none',
        transition: 'background 0.12s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#F5EFE3')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Category dot — vertically centered with first line of text */}
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: dotColor, flexShrink: 0, marginTop: 3 }} />

      {/* Content: title row with time, then subtitle, then calendar */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: '#1A1A14', lineHeight: 1.35 }}>
            {title}
          </div>
          <div style={{ fontSize: 11.5, color: '#7A7468', textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap' }}>
            {showDate && <div style={{ fontWeight: 500, color: '#1A1A14' }}>{formatDate(startDate)}</div>}
            <div>{formatTime(startDate)}</div>
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: '#7A7468', marginTop: 2 }}>
          {label} · {venue}
          {event.city !== 'Nyack' ? ` · ${event.city}` : ''}
          {event.isFree ? ' · Free' : event.price ? ` · ${event.price}` : ''}
        </div>

        <div style={{ marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
          <CalendarDropdown event={event} />
        </div>
      </div>
    </Link>
  )
}
