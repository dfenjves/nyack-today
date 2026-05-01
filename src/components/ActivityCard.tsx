import { Activity } from '@prisma/client'
import type { Category } from '@prisma/client'
import { categoryLabels, getCategoryColor, categoryGradients } from '@/lib/utils/categories'
import Link from 'next/link'
import {
  Music, Laugh, Film, Mic2, Baby, UtensilsCrossed,
  Trophy, Building2, Palette, GraduationCap, Calendar,
} from 'lucide-react'

const categoryLucideIcons: Record<Category, React.ReactNode> = {
  MUSIC:                <Music className="w-8 h-8 text-white" />,
  COMEDY:               <Laugh className="w-8 h-8 text-white" />,
  MOVIES:               <Film className="w-8 h-8 text-white" />,
  THEATER:              <Mic2 className="w-8 h-8 text-white" />,
  FAMILY_KIDS:          <Baby className="w-8 h-8 text-white" />,
  FOOD_DRINK:           <UtensilsCrossed className="w-8 h-8 text-white" />,
  SPORTS_RECREATION:    <Trophy className="w-8 h-8 text-white" />,
  COMMUNITY_GOVERNMENT: <Building2 className="w-8 h-8 text-white" />,
  ART_GALLERIES:        <Palette className="w-8 h-8 text-white" />,
  CLASSES_WORKSHOPS:    <GraduationCap className="w-8 h-8 text-white" />,
  OTHER:                <Calendar className="w-8 h-8 text-white" />,
}

interface ActivityCardProps {
  activity: Activity
}

export default function ActivityCard({ activity }: ActivityCardProps) {
  const categoryLabel = categoryLabels[activity.category]
  const categoryColor = getCategoryColor(activity.category)

  return (
    <Link
      href={activity.websiteUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-surface rounded-xl border border-sand p-4 hover:shadow-md hover:border-terra/30 transition-all"
    >
      <div className="flex gap-4">
        {/* Activity image or category icon fallback */}
        {activity.imageUrl ? (
          <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-oat">
            <img
              src={activity.imageUrl}
              alt={activity.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className={`w-20 h-20 flex-shrink-0 rounded-lg flex items-center justify-center ${categoryGradients[activity.category]}`}>
            {categoryLucideIcons[activity.category]}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="font-display font-semibold text-ink line-clamp-2 leading-tight">
            {activity.title}
          </h3>

          {/* Hours */}
          {activity.hours && (
            <p className="text-sm text-stone-600 mt-1">
              {activity.hours}
            </p>
          )}

          {/* Venue and location */}
          <p className="text-sm text-muted mt-0.5">
            {activity.venue}
            {activity.city !== 'Nyack' && <span> · {activity.city}</span>}
          </p>

          {/* Bottom row: category, price, badges */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryColor}`}>
              {categoryLabel}
            </span>

            {activity.isFree ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                Free
              </span>
            ) : activity.price ? (
              <span className="text-xs text-muted">{activity.price}</span>
            ) : null}

            {activity.isFamilyFriendly && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                Family
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
