export default function EventCardSkeleton() {
  return (
    <div
      className="animate-pulse"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 18px',
        borderBottom: '0.5px solid #EBE4D4',
      }}
    >
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#DDD6C6', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ height: 14, background: '#E8E2D4', borderRadius: 4, width: '60%', marginBottom: 6 }} />
        <div style={{ height: 11, background: '#EDE8DC', borderRadius: 4, width: '40%' }} />
      </div>
      <div style={{ width: 48, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ height: 11, background: '#E8E2D4', borderRadius: 4 }} />
        <div style={{ height: 11, background: '#EDE8DC', borderRadius: 4 }} />
      </div>
    </div>
  )
}

export function EventListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div style={{ background: '#FDF8F0', border: '0.5px solid #DDD6C6', borderRadius: 16, overflow: 'hidden' }}>
      {Array.from({ length: count }).map((_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  )
}
