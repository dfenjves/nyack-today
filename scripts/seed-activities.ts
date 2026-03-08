import { PrismaClient, Category } from '@prisma/client'

const prisma = new PrismaClient()

const seedActivities = [
  {
    title: 'RPM Raceway Go-Karts',
    description: 'Indoor electric go-kart racing at the Palisades Center',
    venue: 'Palisades Center Mall',
    address: '1000 Palisades Center Dr',
    city: 'West Nyack',
    isNyackProper: false,
    category: 'SPORTS_RECREATION' as Category,
    price: '$25-$50',
    isFree: false,
    isFamilyFriendly: true,
    hours: 'Mon-Thu 2pm-9pm, Fri-Sun 11am-10pm',
    websiteUrl: 'https://rpmraceway.com',
    imageUrl: null,
    isActive: true,
  },
  {
    title: 'Bowlerland Lanes',
    description: 'Classic bowling alley with arcade games',
    venue: 'Bowlerland',
    address: '100 E Main St',
    city: 'Nanuet',
    isNyackProper: false,
    category: 'SPORTS_RECREATION' as Category,
    price: '$6-$8 per game',
    isFree: false,
    isFamilyFriendly: true,
    hours: 'Daily 10am-12am',
    websiteUrl: 'https://example.com/bowlerland',
    imageUrl: null,
    isActive: true,
  },
  {
    title: 'Hook Mountain State Park',
    description: 'Scenic hiking trails with Hudson River views',
    venue: 'Hook Mountain',
    address: 'Hook Mountain State Park',
    city: 'Nyack',
    isNyackProper: true,
    category: 'SPORTS_RECREATION' as Category,
    price: null,
    isFree: true,
    isFamilyFriendly: true,
    hours: 'Dawn to dusk',
    websiteUrl: 'https://parks.ny.gov/parks/hookmountain',
    imageUrl: null,
    isActive: true,
  },
  {
    title: 'Nyack Beach State Park',
    description: 'Beach, picnic areas, and hiking along the Hudson',
    venue: 'Nyack Beach State Park',
    address: 'Nyack Beach Rd',
    city: 'Nyack',
    isNyackProper: true,
    category: 'SPORTS_RECREATION' as Category,
    price: '$8 parking (seasonal)',
    isFree: false,
    isFamilyFriendly: true,
    hours: 'Dawn to dusk',
    websiteUrl: 'https://parks.ny.gov/parks/nyackbeach',
    imageUrl: null,
    isActive: true,
  },
  {
    title: 'Edward Hopper House Museum',
    description: 'Birthplace and museum of the famous American artist',
    venue: 'Edward Hopper House',
    address: '82 N Broadway',
    city: 'Nyack',
    isNyackProper: true,
    category: 'ART_GALLERIES' as Category,
    price: '$5 suggested donation',
    isFree: false,
    isFamilyFriendly: true,
    hours: 'Thu-Sun 12pm-5pm',
    websiteUrl: 'https://edwardhopperhouse.org',
    imageUrl: null,
    isActive: true,
  },
  {
    title: 'Strawberry Place',
    description: 'Gourmet chocolate and candy shop',
    venue: 'Strawberry Place',
    address: '72 S Broadway',
    city: 'Nyack',
    isNyackProper: true,
    category: 'FOOD_DRINK' as Category,
    price: null,
    isFree: true,
    isFamilyFriendly: true,
    hours: 'Mon-Sat 10am-6pm, Sun 11am-5pm',
    websiteUrl: 'https://strawberryplace.com',
    imageUrl: null,
    isActive: true,
  },
]

async function main() {
  console.log('Seeding activities...')

  for (const activity of seedActivities) {
    // Check if activity already exists by title and venue
    const existing = await prisma.activity.findFirst({
      where: {
        title: activity.title,
        venue: activity.venue,
      },
    })

    if (existing) {
      console.log(`Skipping "${activity.title}" - already exists`)
      continue
    }

    await prisma.activity.create({
      data: activity,
    })
    console.log(`Created "${activity.title}"`)
  }

  console.log('Seeding complete!')
}

main()
  .catch((e) => {
    console.error('Error seeding activities:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
