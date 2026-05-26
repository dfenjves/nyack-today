import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'Nyack Today - What\'s Happening in Nyack, NY'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(150deg, #1E3A2F 0%, #162C24 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '0 80px 64px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Terra accent bar at top */}
        <div
          style={{
            height: 6,
            background: 'linear-gradient(90deg, #D4622A 0%, #C8973A 100%)',
            marginBottom: 52,
          }}
        />

        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Ring icon */}
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              border: '5px solid #D4622A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#D4622A',
              }}
            />
          </div>
          <span
            style={{
              fontSize: 26,
              fontWeight: 600,
              color: '#F5F0E8',
              letterSpacing: '-0.01em',
            }}
          >
            Nyack Today
          </span>
        </div>

        {/* Main headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div
            style={{
              fontSize: 100,
              fontWeight: 800,
              color: '#F5F0E8',
              lineHeight: 1,
              letterSpacing: '-0.04em',
            }}
          >
            What&apos;s Happening
          </div>
          <div
            style={{
              fontSize: 100,
              fontWeight: 800,
              color: '#D4622A',
              lineHeight: 1,
              letterSpacing: '-0.04em',
            }}
          >
            in Nyack
          </div>
        </div>

        {/* Bottom row: tagline + pills */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              fontSize: 24,
              color: '#8FBD9E',
              fontWeight: 400,
              letterSpacing: '0.01em',
            }}
          >
            Events · Shows · Things To Do · nyacktoday.com
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {['Tonight', 'This Weekend', 'Family', 'Free Events'].map((tag) => (
              <div
                key={tag}
                style={{
                  background: 'rgba(212,98,42,0.15)',
                  border: '1px solid rgba(212,98,42,0.4)',
                  color: '#E8A882',
                  padding: '10px 22px',
                  borderRadius: 999,
                  fontSize: 20,
                  fontWeight: 500,
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
