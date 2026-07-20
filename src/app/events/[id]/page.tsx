import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import CalendarDropdown from '@/components/CalendarDropdown'
import { getEventByStableId } from '@/lib/utils/events-query'
import { formatDate, formatTime } from '@/lib/utils/dates'
import { categoryLabels, getCategoryColor, categoryGradients } from '@/lib/utils/categories'
import { decodeHtmlEntities } from '@/lib/utils/text'
import type { Category } from '@prisma/client'
import {
  Music, Laugh, Film, Mic2, Baby, UtensilsCrossed,
  Trophy, Building2, Palette, GraduationCap, Calendar,
  MapPin, ExternalLink, ArrowLeft,
} from 'lucide-react'

const categoryLucideIcons: Record<Category, React.ReactNode> = {
  MUSIC:                <Music className="w-12 h-12 text-white" />,
  COMEDY:               <Laugh className="w-12 h-12 text-white" />,
  MOVIES:               <Film className="w-12 h-12 text-white" />,
  THEATER:              <Mic2 className="w-12 h-12 text-white" />,
  FAMILY_KIDS:          <Baby className="w-12 h-12 text-white" />,
  FOOD_DRINK:           <UtensilsCrossed className="w-12 h-12 text-white" />,
  SPORTS_RECREATION:    <Trophy className="w-12 h-12 text-white" />,
  COMMUNITY_GOVERNMENT: <Building2 className="w-12 h-12 text-white" />,
  ART_GALLERIES:        <Palette className="w-12 h-12 text-white" />,
  CLASSES_WORKSHOPS:    <GraduationCap className="w-12 h-12 text-white" />,
  OTHER:                <Calendar className="w-12 h-12 text-white" />,
}

interface EventPageProps {
  params: Promise<{ id: string }>
}

// Some sources (e.g. Discord) don't have a real external URL to link to.
function isExternalLink(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { id } = await params
  const event = await getEventByStableId(id)

  if (!event) {
    return { title: 'Event not found' }
  }

  const title = decodeHtmlEntities(event.title)
  const description = event.description
    ? decodeHtmlEntities(event.description).slice(0, 200)
    : `${title} at ${event.venue} on ${formatDate(new Date(event.startDate))}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      images: event.imageUrl ? [{ url: event.imageUrl }] : undefined,
    },
    twitter: {
      card: event.imageUrl ? 'summary_large_image' : 'summary',
      title,
      description,
    },
  }
}

export default async function EventPage({ params }: EventPageProps) {
  const { id } = await params
  const event = await getEventByStableId(id)

  if (!event) {
    notFound()
  }

  const startDate = new Date(event.startDate)
  const endDate = event.endDate ? new Date(event.endDate) : null
  const title = decodeHtmlEntities(event.title)
  const description = event.description ? decodeHtmlEntities(event.description) : null
  const venue = decodeHtmlEntities(event.venue)
  const categoryLabel = categoryLabels[event.category]
  const categoryColor = getCategoryColor(event.category)
  const hasExternalLink = isExternalLink(event.sourceUrl)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: title,
    startDate: startDate.toISOString(),
    ...(endDate && { endDate: endDate.toISOString() }),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: {
      '@type': 'Place',
      name: venue,
      address: event.address ? decodeHtmlEntities(event.address) : `${venue}, ${event.city}`,
    },
    ...(event.imageUrl && { image: [event.imageUrl] }),
    ...(description && { description }),
    ...(hasExternalLink && { url: event.sourceUrl }),
    ...(event.isFree && { offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } }),
  }

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-6">
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-terra transition-colors mb-4 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-terra"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to events
        </Link>

        <article className="bg-surface border border-sand rounded-2xl overflow-hidden">
          {event.imageUrl ? (
            <div className="w-full aspect-video bg-oat">
              <img
                src={event.imageUrl}
                alt={title}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className={`w-full aspect-video flex items-center justify-center ${categoryGradients[event.category]}`}>
              {categoryLucideIcons[event.category]}
            </div>
          )}

          <div className="p-6">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${categoryColor}`}>
                {categoryLabel}
              </span>
              {event.isMarquee && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-harvest/20 text-harvest">
                  ★ Big Event
                </span>
              )}
              {event.isFree ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  Free
                </span>
              ) : event.price ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-oat text-muted">
                  {event.price}
                </span>
              ) : null}
              {event.isFamilyFriendly && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  Family Friendly
                </span>
              )}
              {event.isRecurring && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                  🔁 Recurring
                </span>
              )}
            </div>

            <h1 className="font-display font-semibold text-2xl sm:text-3xl text-ink leading-tight mb-4">
              {title}
            </h1>

            <div className="flex items-start gap-2.5 text-ink mb-3">
              <Calendar className="w-5 h-5 text-terra flex-shrink-0 mt-0.5" aria-hidden="true" />
              <time dateTime={startDate.toISOString()} className="font-medium">
                {formatDate(startDate)} · {formatTime(startDate)}
                {endDate && <> – {formatTime(endDate)}</>}
              </time>
            </div>

            <div className="flex items-start gap-2.5 text-ink mb-5">
              <MapPin className="w-5 h-5 text-terra flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-medium">{venue}</p>
                {event.address && (
                  <p className="text-sm text-muted">{decodeHtmlEntities(event.address)}</p>
                )}
                <p className="text-sm text-muted">{event.city}</p>
              </div>
            </div>

            {description && (
              <div className="border-t border-sand pt-4 mb-5">
                <p className="text-ink whitespace-pre-line leading-relaxed">{description}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              {hasExternalLink && (
                <a
                  href={event.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-terra hover:bg-terra/90 text-cream px-5 py-2.5 rounded-full text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-terra focus-visible:ring-offset-2"
                >
                  Open ticketing site
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                </a>
              )}

              <CalendarDropdown event={event} />
            </div>

            {event.sourceName && (
              <p className="text-xs text-muted mt-4">Source: {event.sourceName}</p>
            )}
          </div>
        </article>
      </main>

      <BottomNav />
    </div>
  )
}
