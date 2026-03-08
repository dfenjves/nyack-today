import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const events = await prisma.event.findMany({
    where: {
      sourceName: "Maureen's Jazz Cellar"
    },
    orderBy: {
      startDate: 'asc'
    },
    take: 10
  })

  console.log('Maureen\'s Jazz Cellar events:')
  console.log('==============================')
  for (const event of events) {
    const dayOfWeek = event.startDate.toLocaleDateString('en-US', { weekday: 'long' })
    const dateStr = event.startDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
    console.log(`${event.title}`)
    console.log(`  Day: ${dayOfWeek}`)
    console.log(`  Date: ${dateStr}`)
    console.log(`  ISO: ${event.startDate.toISOString()}`)
    console.log()
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
