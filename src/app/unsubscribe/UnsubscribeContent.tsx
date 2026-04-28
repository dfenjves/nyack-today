'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function UnsubscribeContent() {
  const searchParams = useSearchParams()
  const status = searchParams.get('status')
  const error = searchParams.get('error')

  if (status === 'success') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-stone-900 mb-2">You&apos;ve been unsubscribed</h1>
        <p className="text-stone-600 mb-6">You won&apos;t receive any more weekly digests from Nyack Today.</p>
        <Link
          href="/"
          className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
        >
          Back to Events
        </Link>
      </div>
    )
  }

  if (status === 'already') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-8 text-center">
        <h1 className="text-2xl font-bold text-stone-900 mb-2">Already unsubscribed</h1>
        <p className="text-stone-600 mb-6">This email is not currently subscribed to the Nyack Today digest.</p>
        <Link href="/" className="text-orange-500 hover:text-orange-600 font-medium">
          Back to Events
        </Link>
      </div>
    )
  }

  if (error === 'invalid' || error === 'missing') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-8 text-center">
        <h1 className="text-2xl font-bold text-stone-900 mb-2">Invalid link</h1>
        <p className="text-stone-600 mb-6">
          This unsubscribe link is invalid or has already been used. Use the link from your most recent digest email.
        </p>
        <Link href="/" className="text-orange-500 hover:text-orange-600 font-medium">
          Back to Events
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-8 text-center">
      <h1 className="text-2xl font-bold text-stone-900 mb-2">Unsubscribe</h1>
      <p className="text-stone-600 mb-6">
        To unsubscribe, use the link at the bottom of your Nyack Today digest email.
      </p>
      <Link href="/" className="text-orange-500 hover:text-orange-600 font-medium">
        Back to Events
      </Link>
    </div>
  )
}
