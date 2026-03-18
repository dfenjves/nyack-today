'use client'

import { Event } from '@prisma/client'
import { useState, useRef, useEffect } from 'react'
import { generateGoogleCalendarUrl, downloadICS } from '@/lib/utils/calendar'

interface CalendarDropdownProps {
  event: Event
}

export default function CalendarDropdown({ event }: CalendarDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    // Close dropdown on Escape key
    function handleEscapeKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscapeKey)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [isOpen])

  const handleGoogleCalendar = () => {
    const url = generateGoogleCalendarUrl(event)
    window.open(url, '_blank', 'noopener,noreferrer')
    setIsOpen(false)
  }

  const handleDownloadICS = () => {
    downloadICS(event)
    setIsOpen(false)
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors"
        aria-label="Add to calendar"
        aria-expanded={isOpen}
      >
        📅 Add to Calendar
      </button>

      {isOpen && (
        <div
          className="absolute left-0 mt-1 w-48 bg-white border border-stone-200 rounded-lg shadow-lg z-50"
          role="menu"
        >
          <button
            onClick={handleGoogleCalendar}
            className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-orange-50 rounded-t-lg transition-colors"
            role="menuitem"
          >
            Google Calendar
          </button>

          <button
            onClick={handleDownloadICS}
            className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-orange-50 transition-colors"
            role="menuitem"
          >
            Apple Calendar
          </button>

          <button
            onClick={handleDownloadICS}
            className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-orange-50 transition-colors"
            role="menuitem"
          >
            Outlook
          </button>

          <button
            onClick={handleDownloadICS}
            className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-orange-50 rounded-b-lg transition-colors"
            role="menuitem"
          >
            Download ICS
          </button>
        </div>
      )}
    </div>
  )
}
