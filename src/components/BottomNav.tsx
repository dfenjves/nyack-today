'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNav() {
  const pathname = usePathname()

  const isEventsActive = pathname === '/'
  const isActivitiesActive = pathname === '/activities'

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-4 py-2 z-50">
        <div className="flex justify-around">
          <Link
            href="/"
            className={`flex flex-col items-center py-2 px-4 ${
              isEventsActive ? 'text-orange-500' : 'text-stone-500'
            }`}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="text-xs mt-1">Events</span>
          </Link>
          <Link
            href="/activities"
            className={`flex flex-col items-center py-2 px-4 ${
              isActivitiesActive ? 'text-orange-500' : 'text-stone-500'
            }`}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
              />
            </svg>
            <span className="text-xs mt-1">Activities</span>
          </Link>
        </div>
      </nav>
      {/* Spacer for mobile bottom nav */}
      <div className="h-16 md:hidden" />
    </>
  )
}
