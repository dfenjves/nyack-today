const { PrismaClient } = require('@prisma/client')

const namedEntities = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

function decodeHtmlEntities(input) {
  if (!input) {
    return input
  }

  let output = input

  for (let pass = 0; pass < 2; pass += 1) {
    output = output.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
      if (entity.startsWith('#x') || entity.startsWith('#X')) {
        const codePoint = parseInt(entity.slice(2), 16)
        return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint)
      }

      if (entity.startsWith('#')) {
        const codePoint = parseInt(entity.slice(1), 10)
        return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint)
      }

      const replacement = namedEntities[entity]
      return replacement ?? match
    })
  }

  return output
}

function decodeField(value) {
  if (value === null || value === undefined) {
    return value
  }
  return decodeHtmlEntities(String(value)).trim()
}

async function normalizeEvents(prisma) {
  const events = await prisma.event.findMany()
  let updated = 0

  for (const event of events) {
    const next = {
      title: decodeField(event.title),
      description: decodeField(event.description),
      venue: decodeField(event.venue),
      address: decodeField(event.address),
      city: decodeField(event.city),
    }

    const hasChanges = Object.entries(next).some(([key, value]) => value !== event[key])
    if (!hasChanges) {
      continue
    }

    await prisma.event.update({
      where: { id: event.id },
      data: next,
    })
    updated += 1
  }

  return updated
}

async function normalizeActivities(prisma) {
  const activities = await prisma.activity.findMany()
  let updated = 0

  for (const activity of activities) {
    const next = {
      title: decodeField(activity.title),
      description: decodeField(activity.description),
      venue: decodeField(activity.venue),
      address: decodeField(activity.address),
      city: decodeField(activity.city),
      hours: decodeField(activity.hours),
    }

    const hasChanges = Object.entries(next).some(([key, value]) => value !== activity[key])
    if (!hasChanges) {
      continue
    }

    await prisma.activity.update({
      where: { id: activity.id },
      data: next,
    })
    updated += 1
  }

  return updated
}

async function run() {
  const prisma = new PrismaClient()

  try {
    const updatedEvents = await normalizeEvents(prisma)
    const updatedActivities = await normalizeActivities(prisma)

    console.log(`Normalized events: ${updatedEvents}`)
    console.log(`Normalized activities: ${updatedActivities}`)
  } catch (error) {
    console.error('Normalization failed:', error)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

run()
