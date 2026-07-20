import Link from 'next/link'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'

export default function EventNotFound() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4" aria-hidden="true">🌙</div>
        <h1 className="font-display font-semibold text-2xl text-ink mb-2">
          Event not found
        </h1>
        <p className="text-muted mb-6">
          This event may have been removed, or the link might be incorrect.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-terra hover:bg-terra/90 text-cream px-5 py-2.5 rounded-full text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-terra focus-visible:ring-offset-2"
        >
          Back to events
        </Link>
      </main>

      <BottomNav />
    </div>
  )
}
