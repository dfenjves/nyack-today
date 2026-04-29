'use client'

import { useState } from 'react'

export default function SubscribeSection() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMessage('')

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (res.ok) {
        setStatus('success')
      } else {
        const data = await res.json()
        setStatus('error')
        setErrorMessage(data.error ?? 'Something went wrong. Please try again.')
      }
    } catch {
      setStatus('error')
      setErrorMessage('Something went wrong. Please try again.')
    }
  }

  return (
    <div
      id="subscribe-section"
      style={{
        background: '#2C5240',
        borderRadius: 18,
        padding: 'clamp(24px, 4vw, 36px) clamp(22px, 4vw, 40px)',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 32,
        position: 'relative',
        overflow: 'hidden',
        flexWrap: 'wrap',
      }}
    >
      {/* Blob decoration */}
      <svg width="200" height="200" viewBox="0 0 200 200" style={{ position: 'absolute', right: -30, bottom: -50, opacity: 0.18, pointerEvents: 'none' }}>
        <ellipse cx="100" cy="100" rx="80" ry="60" fill="#8FBD9E" transform="rotate(20 100 100)" />
        <circle cx="140" cy="80" r="32" fill="#D4622A" />
      </svg>

      <div style={{ flex: 1, position: 'relative', zIndex: 1, minWidth: 220 }}>
        <p style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#8FBD9E', marginBottom: 8, fontWeight: 500 }}>
          Newsletter
        </p>
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(22px, 3vw, 26px)',
          fontWeight: 600,
          color: '#F5F0E8',
          letterSpacing: '-0.015em',
          lineHeight: 1.2,
          marginBottom: 6,
        }}>
          Nyack in your inbox.
        </h3>
        <p style={{ fontSize: 13, color: '#8FBD9E', maxWidth: 380, lineHeight: 1.55 }}>
          Every Thursday morning — what&rsquo;s worth your weekend, hand-picked. No spam, ever.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', gap: 8, position: 'relative', zIndex: 1, flexShrink: 0, flexWrap: 'wrap', minWidth: 280 }}
        aria-live="polite"
      >
        {status === 'success' ? (
          <div style={{
            background: '#F5F0E8', color: '#1E3A2F',
            borderRadius: 20, padding: '12px 20px',
            fontSize: 13, fontWeight: 500,
          }}>
            ✓ You&rsquo;re subscribed.
          </div>
        ) : (
          <>
            <label htmlFor="subscribe-email" className="sr-only">Email address</label>
            <input
              id="subscribe-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@nyack.com"
              disabled={status === 'loading'}
              style={{
                flex: 1,
                minWidth: 200,
                background: 'rgba(245,240,232,0.10)',
                border: '0.5px solid rgba(245,240,232,0.25)',
                color: '#F5F0E8',
                borderRadius: 20,
                padding: '11px 16px',
                fontSize: 13,
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              style={{
                background: '#D4622A',
                color: '#FEF0E6',
                fontSize: 13,
                padding: '11px 18px',
                borderRadius: 20,
                border: 'none',
                cursor: 'pointer',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
                opacity: status === 'loading' ? 0.7 : 1,
              }}
            >
              {status === 'loading' ? 'Subscribing...' : 'Subscribe →'}
            </button>
          </>
        )}
        {status === 'error' && (
          <p style={{ width: '100%', fontSize: 12, color: '#F5C4A8', marginTop: 4 }}>{errorMessage}</p>
        )}
      </form>
    </div>
  )
}
