import { Category } from '@prisma/client'

export const categoryLabels: Record<Category, string> = {
  MUSIC: 'Music',
  COMEDY: 'Comedy',
  MOVIES: 'Movies',
  THEATER: 'Theater',
  FAMILY_KIDS: 'Family & Kids',
  FOOD_DRINK: 'Food & Drink',
  SPORTS_RECREATION: 'Sports & Recreation',
  COMMUNITY_GOVERNMENT: 'Community',
  ART_GALLERIES: 'Art & Galleries',
  CLASSES_WORKSHOPS: 'Classes & Workshops',
  OTHER: 'Other',
}

export const categoryIcons: Record<Category, string> = {
  MUSIC: '🎵',
  COMEDY: '😂',
  MOVIES: '🎬',
  THEATER: '🎭',
  FAMILY_KIDS: '👨‍👩‍👧‍👦',
  FOOD_DRINK: '🍷',
  SPORTS_RECREATION: '⚽',
  COMMUNITY_GOVERNMENT: '🏛️',
  ART_GALLERIES: '🎨',
  CLASSES_WORKSHOPS: '📚',
  OTHER: '📅',
}

// Keywords to help auto-categorize events from scraped data
export const categoryKeywords: Record<Category, string[]> = {
  MUSIC: ['concert', 'music', 'jazz', 'band', 'live music', 'orchestra', 'symphony', 'singer', 'dj'],
  COMEDY: ['comedy', 'comedian', 'stand-up', 'standup', 'laugh', 'improv', 'levity'],
  MOVIES: ['movie', 'film', 'cinema', 'screening', 'documentary'],
  THEATER: ['theater', 'theatre', 'play', 'musical', 'performance', 'drama', 'broadway'],
  FAMILY_KIDS: ['kids', 'children', 'family', 'child', 'youth', 'teen', 'ages'],
  FOOD_DRINK: ['food', 'wine', 'beer', 'tasting', 'dinner', 'brunch', 'cocktail', 'restaurant'],
  SPORTS_RECREATION: ['sports', 'game', 'fitness', 'yoga', 'run', 'race', 'golf', 'tennis'],
  COMMUNITY_GOVERNMENT: ['town hall', 'meeting', 'council', 'village', 'community', 'civic', 'government', 'board'],
  ART_GALLERIES: ['art', 'gallery', 'exhibit', 'exhibition', 'artist', 'painting', 'sculpture'],
  CLASSES_WORKSHOPS: ['class', 'workshop', 'learn', 'lesson', 'course', 'training', 'seminar'],
  OTHER: [],
}

export function guessCategory(title: string, description?: string | null): Category {
  const text = `${title} ${description || ''}`.toLowerCase()

  // Check each category's keywords
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (category === 'OTHER') continue
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return category as Category
      }
    }
  }

  return Category.OTHER
}

export const categoryGradients: Record<Category, string> = {
  MUSIC:                'bg-gradient-to-br from-purple-500 to-indigo-600',
  COMEDY:               'bg-gradient-to-br from-yellow-400 to-orange-500',
  MOVIES:               'bg-gradient-to-br from-red-500 to-rose-600',
  THEATER:              'bg-gradient-to-br from-pink-500 to-rose-500',
  FAMILY_KIDS:          'bg-gradient-to-br from-green-400 to-emerald-500',
  FOOD_DRINK:           'bg-gradient-to-br from-orange-400 to-amber-500',
  SPORTS_RECREATION:    'bg-gradient-to-br from-blue-400 to-cyan-500',
  COMMUNITY_GOVERNMENT: 'bg-gradient-to-br from-slate-400 to-gray-500',
  ART_GALLERIES:        'bg-gradient-to-br from-indigo-400 to-violet-500',
  CLASSES_WORKSHOPS:    'bg-gradient-to-br from-teal-400 to-cyan-500',
  OTHER:                'bg-gradient-to-br from-stone-400 to-stone-500',
}

export function getCategoryColor(category: Category): string {
  const colors: Record<Category, string> = {
    MUSIC: 'bg-purple-100 text-purple-800',
    COMEDY: 'bg-yellow-100 text-yellow-800',
    MOVIES: 'bg-red-100 text-red-800',
    THEATER: 'bg-pink-100 text-pink-800',
    FAMILY_KIDS: 'bg-green-100 text-green-800',
    FOOD_DRINK: 'bg-orange-100 text-orange-800',
    SPORTS_RECREATION: 'bg-blue-100 text-blue-800',
    COMMUNITY_GOVERNMENT: 'bg-gray-100 text-gray-800',
    ART_GALLERIES: 'bg-indigo-100 text-indigo-800',
    CLASSES_WORKSHOPS: 'bg-teal-100 text-teal-800',
    OTHER: 'bg-stone-100 text-stone-800',
  }
  return colors[category]
}
