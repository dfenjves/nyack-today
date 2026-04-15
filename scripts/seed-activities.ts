import { PrismaClient, Category } from '@prisma/client'

const prisma = new PrismaClient()

const seedActivities = [
  // State Parks & Large Recreation Areas
  {
    title: 'Rockland Lake State Park',
    description: '1,133-acre park featuring a 3.2-mile paved trail around the lake, two Olympic-sized swimming pools, 25,000 sq ft zero-entry pool with water slides, two 18-hole golf courses (Championship and Executive), six tennis courts, pickleball, car-top boat launch, fishing, cross-country skiing, sledding, playground, and picnic areas with grills.',
    venue: 'Rockland Lake State Park',
    address: '299 Rockland Lake Rd',
    city: 'Valley Cottage',
    isNyackProper: false,
    category: 'SPORTS_RECREATION' as Category,
    price: 'Free entry, parking $8-10, pool admission varies',
    isFree: false,
    isFamilyFriendly: true,
    hours: 'Dawn to dusk (pool and facilities vary by season)',
    websiteUrl: 'https://parks.ny.gov/visit/state-parks/rockland-lake-state-park',
    imageUrl: null,
    isActive: true,
  },
  {
    title: 'Nyack Beach State Park',
    description: '61-acre riverfront park along the Hudson River offering picnicking, hiking, bicycling, fishing, kayak/windsurfer launching, and cross-country skiing in winter. Southern terminus of the Hudson River Greenway Trail. One of the best hawk and raptor viewing areas in the U.S.',
    venue: 'Nyack Beach State Park',
    address: '663 N Broadway',
    city: 'Upper Nyack',
    isNyackProper: false,
    category: 'SPORTS_RECREATION' as Category,
    price: 'Free entry, parking $8-10',
    isFree: false,
    isFamilyFriendly: true,
    hours: 'Dawn to dusk, year-round',
    websiteUrl: 'https://parks.ny.gov/visit/state-parks/nyack-beach-state-park',
    imageUrl: null,
    isActive: true,
  },
  {
    title: 'Hook Mountain State Park',
    description: 'Part of a 2,000-acre connected park system. Features the popular Hook Mountain and Nyack Beach Loop trail (5.9 miles, moderate difficulty, 1,023 ft elevation gain). Summit at 730 feet offers spectacular Hudson River valley views, historic Knickerbocker Ice House ruins, and excellent bird watching.',
    venue: 'Hook Mountain State Park',
    address: 'Upper Nyack Trail access',
    city: 'Upper Nyack',
    isNyackProper: false,
    category: 'SPORTS_RECREATION' as Category,
    price: 'Free',
    isFree: true,
    isFamilyFriendly: true,
    hours: 'Dawn to dusk',
    websiteUrl: 'https://parks.ny.gov/parks/hookmountain',
    imageUrl: null,
    isActive: true,
  },
  {
    title: 'Tallman Mountain State Park',
    description: 'Features the Tallman Mountain Hudson River Overlook Trail (3.7 miles, 301 ft elevation gain). Offers stunning views of the Hudson River and Piermont Marsh, part of the Hudson River National Estuarine Research Reserve. Great for hiking, bird watching, and nature photography.',
    venue: 'Tallman Mountain State Park',
    address: '9 S Route 9W',
    city: 'Palisades',
    isNyackProper: false,
    category: 'SPORTS_RECREATION' as Category,
    price: 'Free entry, parking fee varies',
    isFree: false,
    isFamilyFriendly: true,
    hours: 'Dawn to dusk',
    websiteUrl: 'https://parks.ny.gov/parks/tallmanmountain',
    imageUrl: null,
    isActive: true,
  },

  // Local Parks
  {
    title: 'Nyack Memorial Park',
    description: '11-acre waterfront park featuring baseball field, basketball courts, children\'s playground, skateboard park, and splash pad. Hosts community events like the Great Nyack Get Together and summer concert series "Music on the Hudson."',
    venue: 'Nyack Memorial Park',
    address: 'Hudson River waterfront',
    city: 'Nyack',
    isNyackProper: true,
    category: 'SPORTS_RECREATION' as Category,
    price: 'Free',
    isFree: true,
    isFamilyFriendly: true,
    hours: 'Dawn to dusk',
    websiteUrl: 'https://visitnyack.org/memorial-park/',
    imageUrl: null,
    isActive: true,
  },
  {
    title: 'South Nyack Park',
    description: 'Fully gated playground for kids, gazebo with live music in summertime, enclosed tennis court, basketball court, and entrance to the Esposito Trail which connects to Piermont. Family-friendly neighborhood park.',
    venue: 'South Nyack Park',
    address: 'Near South Nyack Fire House',
    city: 'South Nyack',
    isNyackProper: false,
    category: 'SPORTS_RECREATION' as Category,
    price: 'Free',
    isFree: true,
    isFamilyFriendly: true,
    hours: 'Dawn to dusk',
    websiteUrl: 'https://www.nyack.gov/maps/Parks',
    imageUrl: null,
    isActive: true,
  },
  {
    title: 'Franklin Street Park',
    description: 'Gated playground with firehouse-themed equipment, two metal climbing structures, basketball court, tennis court, picnic tables, gazebo with live music in summertime, and access to the Esposito Trail to Piermont. Located next to South Nyack fire house.',
    venue: 'Franklin Street Park',
    address: '95 South Franklin Street',
    city: 'South Nyack',
    isNyackProper: false,
    category: 'SPORTS_RECREATION' as Category,
    price: 'Free',
    isFree: true,
    isFamilyFriendly: true,
    hours: 'Dawn to dusk',
    websiteUrl: 'https://visitnyack.org/places/franklin-street-park/',
    imageUrl: null,
    isActive: true,
  },

  // Trails & Waterfront
  {
    title: 'Raymond G. Esposito Memorial Trail',
    description: 'Multi-use rail trail connecting South Nyack to Piermont (approximately 3 miles). Perfect for walking, jogging, and biking. Connects to the Joseph B. Clarke Rail Trail and Old Erie Path. Offers Hudson River views and access to downtown Nyack and Piermont Pier.',
    venue: 'Raymond G. Esposito Memorial Trail',
    address: 'Begins in South Nyack, extends to Piermont',
    city: 'South Nyack',
    isNyackProper: false,
    category: 'SPORTS_RECREATION' as Category,
    price: 'Free',
    isFree: true,
    isFamilyFriendly: true,
    hours: 'Dawn to dusk',
    websiteUrl: 'https://www.traillink.com/trail/joseph-b-clarke-rail-trail/',
    imageUrl: null,
    isActive: true,
  },
  {
    title: 'Piermont Pier',
    description: 'Nearly mile-long (4,000 feet) pier extending into the Hudson River. Walk, jog, bike, or drive on this historic structure. Former Erie Railroad terminus from the mid-1800s and WWII "Last Stop USA" embarkation point. Stunning river views, fishing, and bird watching.',
    venue: 'Piermont Pier',
    address: 'End of Piermont Avenue',
    city: 'Piermont',
    isNyackProper: false,
    category: 'SPORTS_RECREATION' as Category,
    price: 'Free',
    isFree: true,
    isFamilyFriendly: true,
    hours: 'Dawn to dusk',
    websiteUrl: 'https://www.piermont-ny.gov/services/visitors.php',
    imageUrl: null,
    isActive: true,
  },
  {
    title: 'Nyack Marina',
    description: 'Village-owned marina offering public boat launch, seasonal slip rentals, kayak storage racks, and kayak launching. Part of the Hudson River Greenways water trail. Short walk from downtown shops and restaurants.',
    venue: 'Nyack Marina',
    address: 'End of Burd Street',
    city: 'Nyack',
    isNyackProper: true,
    category: 'SPORTS_RECREATION' as Category,
    price: 'Daily parking/launch fees apply',
    isFree: false,
    isFamilyFriendly: true,
    hours: 'Dawn to dusk (seasonal)',
    websiteUrl: 'https://visitnyack.org/hudson-river-boating-nyack/',
    imageUrl: null,
    isActive: true,
  },

  // Indoor Recreation
  {
    title: 'K1 Speed Indoor Go-Karts',
    description: 'Indoor electric go-kart racing on professionally designed track. All-electric karts reach speeds up to 45 mph. Pro Karts for ages 13+ (56" tall), Jr Karts for ages 8+ (48" tall). Family entertainment center inside Palisades Center Mall.',
    venue: 'K1 Speed West Nyack',
    address: '2272 Palisades Center Dr (2nd floor)',
    city: 'West Nyack',
    isNyackProper: false,
    category: 'SPORTS_RECREATION' as Category,
    price: 'Varies by race package',
    isFree: false,
    isFamilyFriendly: true,
    hours: 'Mon-Sun 11:00 AM - 7:00 PM (check website for current hours)',
    websiteUrl: 'https://www.k1speed.com/west-nyack-location.html',
    imageUrl: null,
    isActive: true,
  },
  {
    title: 'Palisades Center Ice Rink',
    description: 'Indoor ice skating rink offering public skating sessions, skating lessons, and Learn to Skate programs. Located inside Palisades Center Mall. Family-friendly recreational skating year-round.',
    venue: 'Palisades Center Ice Rink',
    address: '4900 Palisades Center Dr',
    city: 'West Nyack',
    isNyackProper: false,
    category: 'SPORTS_RECREATION' as Category,
    price: 'Admission and skate rental fees apply',
    isFree: false,
    isFamilyFriendly: true,
    hours: 'Mon-Sun 11:00 AM - 7:00 PM (public sessions vary - check website)',
    websiteUrl: 'https://palisadescentericerink.com/',
    imageUrl: null,
    isActive: true,
  },
  {
    title: 'Palisades Climb Adventure',
    description: 'World\'s tallest indoor ropes course at 85 feet. Challenging multi-level climbing adventure with various obstacles and zip lines. Safety equipment and instruction provided. Age and height restrictions apply.',
    venue: 'Palisades Climb Adventure',
    address: 'Palisades Center Mall',
    city: 'West Nyack',
    isNyackProper: false,
    category: 'SPORTS_RECREATION' as Category,
    price: 'Admission fees apply',
    isFree: false,
    isFamilyFriendly: true,
    hours: 'Varies (check mall website)',
    websiteUrl: 'https://palisadescenter.com/',
    imageUrl: null,
    isActive: true,
  },

  // Fitness & Recreation Centers
  {
    title: 'Rockland County YMCA',
    description: 'Full-service fitness center featuring gym, pool, weight room, sauna, whirlpool, and multi-purpose room. Offers fitness classes, swimming programs, and community wellness activities. Membership-based facility.',
    venue: 'Rockland County YMCA',
    address: '35 South Broadway',
    city: 'Nyack',
    isNyackProper: true,
    category: 'SPORTS_RECREATION' as Category,
    price: 'Membership required',
    isFree: false,
    isFamilyFriendly: true,
    hours: 'Varies by day (check website)',
    websiteUrl: 'https://www.rocklandymca.org/main/nyack-health-fitness/',
    imageUrl: null,
    isActive: true,
  },

  // Arts & Culture
  {
    title: 'Edward Hopper House Museum & Study Center',
    description: 'Birthplace and boyhood home of renowned American artist Edward Hopper (1882-1967). Built in 1858, now a museum and community art center. Features rotating exhibitions, Hopper\'s first studio, early artworks, model boats, and memorabilia. Listed on the National Register of Historic Places.',
    venue: 'Edward Hopper House Museum & Study Center',
    address: '82 North Broadway',
    city: 'Nyack',
    isNyackProper: true,
    category: 'ART_GALLERIES' as Category,
    price: 'Suggested donation',
    isFree: false,
    isFamilyFriendly: true,
    hours: 'Thu-Sun 12:00 PM - 5:00 PM',
    websiteUrl: 'https://www.edwardhopperhouse.org/',
    imageUrl: null,
    isActive: true,
  },

  // Libraries
  {
    title: 'Nyack Library',
    description: 'Free association library offering language classes, cooking sessions, art workshops, music gatherings, storytime for children, virtual author talks, book discussion groups, and museum pass borrowing. Ample parking and quiet study spaces available.',
    venue: 'Nyack Library',
    address: '59 S Broadway',
    city: 'Nyack',
    isNyackProper: true,
    category: 'COMMUNITY_GOVERNMENT' as Category,
    price: 'Free',
    isFree: true,
    isFamilyFriendly: true,
    hours: 'Mon 11am-8pm, Tue-Thu 10am-8pm, Fri 10am-6pm, Sat 10am-5pm, Sun 12pm-5pm',
    websiteUrl: 'https://www.nyacklibrary.org/',
    imageUrl: null,
    isActive: true,
  },

  // Movies
  {
    title: 'AMC Palisades 21',
    description: '21-screen movie theater featuring IMAX and REAL-D 3D. Premium amenities include reclining seats, reserved seating, mobile food ordering, assisted listening devices, and wheelchair access. $5 ticket Tuesdays.',
    venue: 'AMC Palisades 21',
    address: '4403 Palisades Ctr Dr',
    city: 'West Nyack',
    isNyackProper: false,
    category: 'MOVIES' as Category,
    price: 'Varies by showtime; $5 on Tuesdays',
    isFree: false,
    isFamilyFriendly: true,
    hours: 'Mon-Sun 11:00 AM - 11:00 PM (showtimes vary)',
    websiteUrl: 'https://www.amctheatres.com/movie-theatres/west-nyack/amc-palisades-21',
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
