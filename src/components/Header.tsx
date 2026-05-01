'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  const handleEventsClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setMenuOpen(false)

    if (pathname === '/') {
      const eventsSection = document.getElementById('events-section')
      eventsSection?.scrollIntoView({ behavior: 'smooth' })
    } else {
      router.push('/')
    }
  }

  const handleSubscribeClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setMenuOpen(false)

    if (pathname === '/') {
      const subscribeSection = document.getElementById('subscribe-section')
      subscribeSection?.scrollIntoView({ behavior: 'smooth' })
    } else {
      router.push('/#subscribe-section')
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-forest border-b border-forest shadow-sm">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-1.5">
          <span className="text-2xl font-display font-semibold text-oat tracking-tight">Nyack</span>
          <span className="text-2xl font-display font-semibold text-sage tracking-tight">Today</span>
        </Link>

        {/* Mobile menu button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden p-2 text-oat/70 hover:text-oat"
          aria-label="Toggle menu"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {menuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          <button
            onClick={handleEventsClick}
            className="text-sm text-oat/70 hover:text-oat transition-colors cursor-pointer"
          >
            Events
          </button>
          <Link
            href="/activities"
            className="text-sm text-oat/70 hover:text-oat transition-colors"
          >
            Always Available
          </Link>
          <Link
            href="/submit"
            className="text-sm text-oat/70 hover:text-oat transition-colors"
          >
            Submit Event
          </Link>
          <button
            onClick={handleSubscribeClick}
            className="bg-terra hover:bg-terra/90 text-cream px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer"
          >
            Subscribe
          </button>
        </nav>
      </div>

      {/* Mobile nav */}
      {menuOpen && (
        <nav className="md:hidden border-t border-forest/50 bg-deep">
          <button
            onClick={handleEventsClick}
            className="block w-full text-left px-4 py-3 text-oat/80 hover:bg-forest/50 hover:text-oat text-sm"
          >
            Events
          </button>
          <Link
            href="/activities"
            className="block px-4 py-3 text-oat/80 hover:bg-forest/50 hover:text-oat text-sm"
            onClick={() => setMenuOpen(false)}
          >
            Always Available
          </Link>
          <Link
            href="/submit"
            className="block px-4 py-3 text-oat/80 hover:bg-forest/50 hover:text-oat text-sm"
            onClick={() => setMenuOpen(false)}
          >
            Submit Event
          </Link>
          <button
            onClick={handleSubscribeClick}
            className="block w-full text-left px-4 py-3 text-terra font-medium text-sm hover:bg-forest/50"
          >
            Subscribe to Weekly Digest
          </button>
        </nav>
      )}
    </header>
  )
}
