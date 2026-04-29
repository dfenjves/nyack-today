import { Activity } from '@prisma/client'
import { categoryLabels, categoryHexColors } from '@/lib/utils/categories'
import Link from 'next/link'
import CatIcon from './CatIcon'

interface ActivityCardProps {
  activity: Activity
  compact?: boolean
}

export default function ActivityCard({ activity, compact = false }: ActivityCardProps) {
  const label = categoryLabels[activity.category]
  const color = categoryHexColors[activity.category]

  const content = (
    <>
      {/* Header area with category icon */}
      {!compact && (
        <div style={{
          height: 140,
          background: color + '14',
          backgroundImage: `repeating-linear-gradient(135deg, ${color}10 0 6px, transparent 6px 14px)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {activity.imageUrl ? (
            <img src={activity.imageUrl} alt={activity.title} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: color, color: '#FEF0E6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CatIcon category={activity.category} size={26} color="#FEF0E6" />
            </div>
          )}
          <div style={{ position: 'absolute', bottom: 10, left: 14, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color, fontWeight: 500 }}>
            {label.toLowerCase()}.jpg
          </div>
        </div>
      )}

      {/* Body */}
      <div style={{ padding: compact ? '14px 16px' : 18, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {compact && (
          <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '18', color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
            <CatIcon category={activity.category} size={18} color={color} />
          </div>
        )}

        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontSize: compact ? 16 : 18,
          fontWeight: 600, color: '#1A1A14',
          letterSpacing: '-0.01em', lineHeight: 1.2, margin: 0,
        }}>
          {activity.title}
        </h3>

        <div style={{ fontSize: 11.5, color: '#7A7468', letterSpacing: '0.04em' }}>
          {activity.venue}
          {activity.city !== 'Nyack' && ` · ${activity.city}`}
        </div>

        {activity.description && (
          <p style={{ fontSize: 13, color: '#3A3A2A', lineHeight: 1.55, margin: 0 }}>
            {activity.description}
          </p>
        )}

        {activity.hours && (
          <p style={{ fontSize: 12, color: '#7A7468', margin: 0 }}>{activity.hours}</p>
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 'auto', paddingTop: 6, flexWrap: 'wrap' }}>
          {activity.isFree && (
            <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, background: '#E8EFE0', color: '#1E3A2F', fontWeight: 500, border: '0.5px solid #C8DFBE' }}>
              Free
            </span>
          )}
          {!activity.isFree && activity.price && (
            <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, background: '#F5F0E8', color: '#3A3A2A', fontWeight: 500, border: '0.5px solid #DDD6C6' }}>
              {activity.price}
            </span>
          )}
          {activity.isFamilyFriendly && (
            <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, background: '#E5ECF3', color: '#3A5577', fontWeight: 500, border: '0.5px solid #C0D0DF' }}>
              Family
            </span>
          )}
        </div>
      </div>
    </>
  )

  return (
    <Link
      href={activity.websiteUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#FDF8F0',
        border: '0.5px solid #DDD6C6',
        borderRadius: 16,
        overflow: 'hidden',
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
      {content}
    </Link>
  )
}
