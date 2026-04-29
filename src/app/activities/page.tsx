'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import ActivityCard from '@/components/ActivityCard'
import BottomNav from '@/components/BottomNav'
import Footer from '@/components/Footer'
import { Category } from '@prisma/client'
import { Activity } from '@prisma/client'

const ACT_FILTERS = ['All', 'Outdoors', 'Family', 'Free', 'Food & Drink', 'Art']

const chipBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: 12,
  padding: '7px 14px',
  borderRadius: 20,
  cursor: 'pointer',
  border: '0.5px solid',
  userSelect: 'none',
  transition: 'all 0.15s',
  fontWeight: 400,
  whiteSpace: 'nowrap',
  fontFamily: 'inherit',
  background: 'transparent',
}

export default function ActivitiesPage() {
  const [filter, setFilter] = useState('All')
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/activities')
      .then((r) => r.json())
      .then((data) => setActivities(data.activities ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = activities.filter((a) => {
    if (filter === 'All') return true
    if (filter === 'Free') return a.isFree
    if (filter === 'Family') return a.isFamilyFriendly
    if (filter === 'Outdoors') return a.category === 'SPORTS_RECREATION'
    if (filter === 'Food & Drink') return a.category === 'FOOD_DRINK'
    if (filter === 'Art') return a.category === 'ART_GALLERIES'
    return true
  })

  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero */}
      <section style={{ background: '#1E3A2F', padding: 'clamp(36px, 5vw, 56px) clamp(20px, 4vw, 48px)', position: 'relative', overflow: 'hidden' }}>
        {/* Blob */}
        <svg width="360" height="360" viewBox="0 0 360 360" style={{ position: 'absolute', right: -80, top: -60, pointerEvents: 'none', opacity: 1 }} aria-hidden="true">
          <ellipse cx="180" cy="170" rx="150" ry="115" fill="#8FBD9E" opacity="0.18" transform="rotate(18 180 170)" />
          <ellipse cx="225" cy="135" rx="80" ry="65" fill="#F5F0E8" opacity="0.12" />
          <ellipse cx="120" cy="220" rx="50" ry="40" fill="#D4622A" opacity="0.18" />
          <circle cx="265" cy="220" r="22" fill="#C8973A" opacity="0.25" />
        </svg>

        <div className="max-w-[1100px] mx-auto" style={{ position: 'relative' }}>
          <span style={{
            display: 'inline-block', background: '#C8973A', color: '#FEF0E6',
            fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
            padding: '5px 10px', borderRadius: 12, fontWeight: 500, marginBottom: 16,
          }}>
            Always on
          </span>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(38px, 5vw, 56px)',
            fontWeight: 600, color: '#F5F0E8', lineHeight: 1.05,
            maxWidth: 600, letterSpacing: '-0.025em', marginBottom: 14,
          }}>
            Things you can do anytime.
          </h1>

          <p style={{ fontSize: 16, color: '#8FBD9E', maxWidth: 520, lineHeight: 1.55, marginBottom: 28 }}>
            Trails, parks, museums, and the slow pleasures of Main Street — the Nyack you can show up for any day of the week.
          </p>

          <div className="flex flex-wrap gap-2">
            {ACT_FILTERS.map((f) => {
              const active = filter === f
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    ...chipBase,
                    ...(active
                      ? { background: '#D4622A', color: '#FEF0E6', borderColor: '#D4622A' }
                      : { background: 'rgba(245,240,232,0.10)', color: '#C5DFC9', borderColor: 'rgba(245,240,232,0.20)' }
                    ),
                  }}
                >
                  {f}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <main style={{ background: '#F5F0E8' }}>
        <div className="max-w-[1100px] mx-auto" style={{ padding: 'clamp(28px, 5vw, 48px) clamp(20px, 4vw, 48px) clamp(40px, 6vw, 56px)' }}>
          {/* Section header */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A7468', marginBottom: 6, fontWeight: 500 }}>
              The list
            </p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: '#1A1A14', letterSpacing: '-0.01em', lineHeight: 1.2, margin: 0 }}>
              {filtered.length} {filtered.length === 1 ? 'way' : 'ways'} to spend a Nyack afternoon
            </h2>
          </div>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="animate-pulse" style={{ background: '#FDF8F0', border: '0.5px solid #DDD6C6', borderRadius: 16, height: 280 }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ background: '#FDF8F0', border: '0.5px dashed #DDD6C6', borderRadius: 16, padding: 40, textAlign: 'center', color: '#7A7468', fontSize: 13 }}>
              No activities match that filter.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {filtered.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
            </div>
          )}

          {/* Hike Nyack promo */}
          <div style={{
            marginTop: 'clamp(36px, 5vw, 56px)',
            background: '#C8973A',
            borderRadius: 18,
            padding: 'clamp(24px, 4vw, 36px) clamp(22px, 4vw, 40px)',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 36,
            flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <p style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#5A4416', marginBottom: 8, fontWeight: 500 }}>
                The map
              </p>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(26px, 4vw, 34px)', fontWeight: 700, color: '#1E3A2F', letterSpacing: '-0.02em', lineHeight: 1.05, marginBottom: 10 }}>
                Hike Nyack.
              </h3>
              <p style={{ fontSize: 14, color: '#3A2E12', maxWidth: 380, lineHeight: 1.55, marginBottom: 16 }}>
                Hook Mountain, Nyack Beach, and the riverfront. Free at the visitor center.
              </p>
              <a
                href="https://parks.ny.gov/parks/hookMountain"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  background: '#1E3A2F', color: '#F5F0E8',
                  fontSize: 13, padding: '11px 18px', borderRadius: 20,
                  textDecoration: 'none', fontWeight: 500,
                }}
              >
                Learn more →
              </a>
            </div>
          </div>
        </div>
      </main>

      <Footer />
      <BottomNav />
    </div>
  )
}
