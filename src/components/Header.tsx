'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

const links = [
  { href: '/', label: 'Events' },
  { href: '/activities', label: 'Always On' },
  { href: '/submit', label: 'Submit' },
]

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  const handleSubscribeClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setMenuOpen(false)
    if (pathname === '/') {
      document.getElementById('subscribe-section')?.scrollIntoView({ behavior: 'smooth' })
    } else {
      router.push('/#subscribe-section')
    }
  }

  return (
    <header className="sticky top-0 z-50" style={{ background: '#1E3A2F' }}>
      <div className="max-w-[1100px] mx-auto px-5 md:px-8 flex items-center justify-between gap-6" style={{ padding: '18px 32px' }}>
        <Link
          href="/"
          className="shrink-0 no-underline"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 600,
            color: '#F5F0E8',
            letterSpacing: '-0.01em',
            textDecoration: 'none',
          }}
        >
          Nyack Today
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-7">
          {links.map((l) => {
            const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href)
            return (
              <Link
                key={l.href}
                href={l.href}
                style={{
                  fontSize: 13,
                  color: active ? '#F5F0E8' : '#8FBD9E',
                  fontWeight: active ? 500 : 400,
                  textDecoration: 'none',
                  paddingBottom: 2,
                  borderBottom: active ? '1px solid #D4622A' : '1px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                {l.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-3">
          {/* Desktop subscribe */}
          <button
            onClick={handleSubscribeClick}
            className="hidden md:block"
            style={{
              background: '#D4622A',
              color: '#FEF0E6',
              fontSize: 12,
              padding: '8px 16px',
              borderRadius: 20,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
              fontFamily: 'inherit',
            }}
          >
            Subscribe →
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menu"
            className="md:hidden flex items-center justify-center"
            style={{
              background: 'transparent',
              border: '0.5px solid rgba(245,240,232,0.25)',
              borderRadius: 10,
              width: 36,
              height: 36,
              padding: 0,
              cursor: 'pointer',
              color: '#F5F0E8',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              {menuOpen
                ? <><path d="M6 6l12 12" /><path d="M18 6l-12 12" /></>
                : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>
              }
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div
          className="md:hidden absolute left-0 right-0"
          style={{
            background: '#1E3A2F',
            borderTop: '0.5px solid rgba(245,240,232,0.15)',
            padding: '8px 20px 16px',
            zIndex: 10,
          }}
        >
          {links.map((l) => {
            const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href)
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'block',
                  padding: '12px 4px',
                  fontSize: 14,
                  color: active ? '#F5F0E8' : '#8FBD9E',
                  fontWeight: active ? 500 : 400,
                  textDecoration: 'none',
                  borderBottom: '0.5px solid rgba(245,240,232,0.08)',
                }}
              >
                {l.label}
              </Link>
            )
          })}
          <button
            onClick={handleSubscribeClick}
            style={{
              marginTop: 12,
              width: '100%',
              background: '#D4622A',
              color: '#FEF0E6',
              fontSize: 13,
              padding: '11px 16px',
              borderRadius: 20,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
              fontFamily: 'inherit',
            }}
          >
            Subscribe →
          </button>
        </div>
      )}
    </header>
  )
}
