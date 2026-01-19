import { Activity } from '@prisma/client'
import { categoryIcons, categoryLabels, getCategoryColor } from '@/lib/utils/categories'
import Link from 'next/link'

interface ActivityCardProps {
  activity: Activity
}

export default function ActivityCard({ activity }: ActivityCardProps) {
  const categoryIcon = categoryIcons[activity.category]
  const categoryLabel = categoryLabels[activity.category]
  const categoryColor = getCategoryColor(activity.category)

  return (
    <Link
      href={activity.websiteUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white rounded-xl border border-stone-200 p-4 hover:shadow-md hover:border-orange-200 transition-all"
    >
      <div className="flex gap-4">
        {/* Activity image or category icon fallback */}
        {activity.imageUrl ? (
          <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-stone-100">
            <img
              src={activity.imageUrl}
              alt={activity.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-20 h-20 flex-shrink-0 rounded-lg bg-orange-50 flex items-center justify-center text-3xl">
            {categoryIcon}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="font-semibold text-stone-900 line-clamp-2 leading-tight">
            {activity.title}
          </h3>

          {/* Hours */}
          {activity.hours && (
            <p className="text-sm text-stone-600 mt-1">
              {activity.hours}
            </p>
          )}

          {/* Venue and location */}
          <p className="text-sm text-stone-500 mt-0.5">
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
              <span className="text-xs text-stone-500">{activity.price}</span>
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
