import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const result = await prisma.event.deleteMany({
    where: {
      sourceName: "Maureen's Jazz Cellar"
    }
  })

  console.log(`Deleted ${result.count} Maureen's Jazz Cellar events`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
