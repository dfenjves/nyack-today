'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-stone-200 shadow-sm">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold text-orange-500">Nyack</span>
          <span className="text-2xl font-light text-stone-700">Today</span>
        </Link>

        {/* Mobile menu button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden p-2 text-stone-600 hover:text-stone-900"
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
          <Link
            href="/"
            className="text-stone-600 hover:text-orange-500 transition-colors"
          >
            Events
          </Link>
          <Link
            href="/activities"
            className="text-stone-600 hover:text-orange-500 transition-colors"
          >
            Always Available
          </Link>
        </nav>
      </div>

      {/* Mobile nav */}
      {menuOpen && (
        <nav className="md:hidden border-t border-stone-200 bg-white">
          <Link
            href="/"
            className="block px-4 py-3 text-stone-600 hover:bg-stone-50 hover:text-orange-500"
            onClick={() => setMenuOpen(false)}
          >
            Events
          </Link>
          <Link
            href="/activities"
            className="block px-4 py-3 text-stone-600 hover:bg-stone-50 hover:text-orange-500"
            onClick={() => setMenuOpen(false)}
          >
            Always Available
          </Link>
        </nav>
      )}
    </header>
  )
}
