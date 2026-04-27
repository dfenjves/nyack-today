import { Suspense } from 'react'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import UnsubscribeContent from './UnsubscribeContent'

export const metadata = {
  title: 'Unsubscribe — Nyack Today',
}

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-12">
        <Suspense fallback={<div className="text-center text-stone-500">Loading...</div>}>
          <UnsubscribeContent />
        </Suspense>
      </main>
      <BottomNav />
    </div>
  )
}
