'use client'

import { useState, useRef, useEffect } from 'react'
import { Share2, Facebook, X as XIcon, MessageCircle, Smartphone, Mail, Copy, Check } from 'lucide-react'

interface ShareButtonProps {
  title: string
  path: string
}

export default function ShareButton({ title, path }: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleEscapeKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
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

  const getUrl = () => `${window.location.origin}${path}`

  const handleMainClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url: getUrl() })
      } catch {
        // User cancelled the native share sheet — nothing to do.
      }
      return
    }

    setIsOpen(!isOpen)
  }

  const openShareLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
    setIsOpen(false)
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access denied — link is still visible in the address bar.
    }
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={handleMainClick}
        className="inline-flex items-center gap-2 bg-oat hover:bg-sand text-ink px-5 py-2.5 rounded-full text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-terra focus-visible:ring-offset-2"
        aria-label="Share this event"
        aria-expanded={isOpen}
      >
        <Share2 className="w-4 h-4" aria-hidden="true" />
        Share
      </button>

      {isOpen && (
        <div
          className="absolute left-0 mt-1 w-48 bg-white border border-sand rounded-lg shadow-lg z-50"
          role="menu"
        >
          <button
            onClick={() => openShareLink(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getUrl())}`)}
            className="w-full flex items-center gap-2.5 text-left px-4 py-2 text-sm text-ink hover:bg-cream rounded-t-lg transition-colors"
            role="menuitem"
          >
            <Facebook className="w-4 h-4 text-muted" aria-hidden="true" />
            Facebook
          </button>

          <button
            onClick={() => openShareLink(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(getUrl())}`)}
            className="w-full flex items-center gap-2.5 text-left px-4 py-2 text-sm text-ink hover:bg-cream transition-colors"
            role="menuitem"
          >
            <XIcon className="w-4 h-4 text-muted" aria-hidden="true" />
            X
          </button>

          <button
            onClick={() => openShareLink(`https://wa.me/?text=${encodeURIComponent(`${title} ${getUrl()}`)}`)}
            className="w-full flex items-center gap-2.5 text-left px-4 py-2 text-sm text-ink hover:bg-cream transition-colors"
            role="menuitem"
          >
            <MessageCircle className="w-4 h-4 text-muted" aria-hidden="true" />
            WhatsApp
          </button>

          <button
            onClick={() => openShareLink(`sms:&body=${encodeURIComponent(`${title} ${getUrl()}`)}`)}
            className="w-full flex items-center gap-2.5 text-left px-4 py-2 text-sm text-ink hover:bg-cream transition-colors"
            role="menuitem"
          >
            <Smartphone className="w-4 h-4 text-muted" aria-hidden="true" />
            Messages
          </button>

          <button
            onClick={() => openShareLink(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(getUrl())}`)}
            className="w-full flex items-center gap-2.5 text-left px-4 py-2 text-sm text-ink hover:bg-cream transition-colors"
            role="menuitem"
          >
            <Mail className="w-4 h-4 text-muted" aria-hidden="true" />
            Email
          </button>

          <button
            onClick={handleCopyLink}
            className="w-full flex items-center gap-2.5 text-left px-4 py-2 text-sm text-ink hover:bg-cream rounded-b-lg transition-colors"
            role="menuitem"
          >
            {copied ? (
              <Check className="w-4 h-4 text-sage" aria-hidden="true" />
            ) : (
              <Copy className="w-4 h-4 text-muted" aria-hidden="true" />
            )}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      )}
    </div>
  )
}
