'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Event } from '@prisma/client'
import { formatTime, formatDate } from '@/lib/utils/dates'
import { categoryLabels, categoryHexColors } from '@/lib/utils/categories'
import { decodeHtmlEntities } from '@/lib/utils/text'
import CatIcon from './CatIcon'

function convertDates(events: Event[]): Event[] {
  return events.map((e) => ({
    ...e,
    startDate: new Date(e.startDate),
    endDate: e.endDate ? new Date(e.endDate) : null,
    createdAt: new Date(e.createdAt),
    updatedAt: new Date(e.updatedAt),
  }))
}

function FeaturedCard({ event }: { event: Event }) {
  const color = categoryHexColors[event.category]
  const label = categoryLabels[event.category]
  const title = decodeHtmlEntities(event.title)
  const startDate = new Date(event.startDate)

  return (
    <Link
      href={event.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="col-span-full no-underline"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        background: '#D4622A',
        borderRadius: 16,
        padding: '22px 24px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.15s',
        textDecoration: 'none',
        gridColumn: '1 / -1',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      {/* bg circle decoration */}
      <svg width="180" height="180" viewBox="0 0 180 180" style={{ position: 'absolute', right: -40, top: -40, opacity: 0.12, pointerEvents: 'none' }}>
        <circle cx="90" cy="90" r="70" fill="#FEF0E6" />
      </svg>

      {/* Icon circle */}
      <div style={{
        width: 60, height: 60,
        background: 'rgba(255,255,255,0.18)',
        borderRadius: '50%',
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#FEF0E6',
      }}>
        {event.imageUrl
          ? <img src={event.imageUrl} alt="" style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover' }} />
          : <CatIcon category={event.category} size={26} color="#FEF0E6" />
        }
      </div>

      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <div style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#F5C4A8', marginBottom: 4, fontWeight: 500 }}>
          {label} · {formatDate(startDate)}
        </div>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18, fontWeight: 600, color: '#FEF0E6',
          letterSpacing: '-0.005em', lineHeight: 1.25,
        }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: '#F5C4A8', marginTop: 6 }}>
          {formatTime(startDate)} · {decodeHtmlEntities(event.venue)}
          {event.isFree ? ' · Free' : event.price ? ` · ${event.price}` : ''}
        </div>
      </div>

      <div style={{ position: 'relative', alignSelf: 'flex-start', flexShrink: 0 }}>
        <span style={{
          display: 'inline-block',
          background: '#1E3A2F', color: '#C8973A',
          fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
          padding: '5px 10px', borderRadius: 12, fontWeight: 500,
        }}>
          ★ Big event
        </span>
      </div>
    </Link>
  )
}

function MarqueeCard({ event }: { event: Event }) {
  const color = categoryHexColors[event.category]
  const label = categoryLabels[event.category]
  const title = decodeHtmlEntities(event.title)
  const startDate = new Date(event.startDate)

  return (
    <Link
      href={event.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#FDF8F0',
        border: '0.5px solid #DDD6C6',
        borderRadius: 14,
        padding: 18,
        textDecoration: 'none',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.borderColor = color + '50'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.borderColor = '#DDD6C6'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ width: 28, height: 4, borderRadius: 2, background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A7468', fontWeight: 500 }}>
          {label} · {formatDate(startDate)}
        </span>
      </div>

      {event.imageUrl && (
        <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 12, aspectRatio: '16/9' }}>
          <img src={event.imageUrl} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}

      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 15, fontWeight: 600, color: '#1A1A14',
        lineHeight: 1.3, letterSpacing: '-0.005em', marginBottom: 6,
      }}>
        {title}
      </div>

      <div style={{ fontSize: 12, color: '#7A7468', lineHeight: 1.5 }}>
        {formatTime(startDate)} · {decodeHtmlEntities(event.venue)}
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
        {event.isFree && (
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#E8EFE0', color: '#1E3A2F', fontWeight: 500 }}>Free</span>
        )}
        {!event.isFree && event.price && (
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#F5F0E8', color: '#7A7468', fontWeight: 500 }}>{event.price}</span>
        )}
        {event.isFamilyFriendly && (
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#E5ECF3', color: '#3A5577', fontWeight: 500 }}>Family</span>
        )}
        {event.isRecurring && (
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#F5EBD9', color: '#8B6618', fontWeight: 500 }}>↻ Weekly</span>
        )}
      </div>
    </Link>
  )
}

export default function MarqueeSection() {
  const [events, setEvents] = useState<Event[]>([])

  useEffect(() => {
    fetch('/api/events?marquee=true&limit=3')
      .then((r) => r.json())
      .then((data) => setEvents(convertDates(data.events ?? [])))
      .catch(() => {})
  }, [])

  if (events.length === 0) return null

  return (
    <div style={{ marginBottom: 48 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16, gap: 16 }}>
        <div>
          <p style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A7468', marginBottom: 6, fontWeight: 500 }}>
            Big events
          </p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: '#1A1A14', letterSpacing: '-0.01em', lineHeight: 1.2, margin: 0 }}>
            Don&rsquo;t miss
          </h2>
        </div>
      </div>

      {/* Grid: featured card spans full width, remaining cards in columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 14,
        }}
        className="grid-cols-1 md:grid-cols-2"
      >
        {events[0] && <FeaturedCard event={events[0]} />}
        {events.slice(1).map((e) => <MarqueeCard key={e.id} event={e} />)}
      </div>
    </div>
  )
}
