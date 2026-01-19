import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'Nyack Today - Events in Nyack, NY'
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
          background: 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Sun icon */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            backgroundColor: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 32,
            boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              backgroundColor: '#f97316',
            }}
          />
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: 'white',
            marginBottom: 16,
            textShadow: '0 2px 10px rgba(0,0,0,0.2)',
          }}
        >
          Nyack Today
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 32,
            color: 'rgba(255,255,255,0.9)',
            marginBottom: 48,
          }}
        >
          What's Happening in Nyack
        </div>

        {/* Features */}
        <div
          style={{
            display: 'flex',
            gap: 24,
          }}
        >
          {['Tonight', 'This Weekend', 'Family Events', 'Free Events'].map((text) => (
            <div
              key={text}
              style={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                color: 'white',
                padding: '12px 24px',
                borderRadius: 999,
                fontSize: 20,
                fontWeight: 500,
              }}
            >
              {text}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
