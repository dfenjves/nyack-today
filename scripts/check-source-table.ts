/**
 * Verifies the Source table from prisma/manual_source_migration.sql is present
 * and readable through the Prisma client.
 *
 *   npx tsx scripts/check-source-table.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const count = await prisma.source.count()
  console.log('prisma.source.count() =', count)

  const modes = await prisma.$queryRawUnsafe(
    `SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'SourceFetchMode' ORDER BY e.enumsortorder`
  )
  console.log('SourceFetchMode enum values:', modes)

  const rls = await prisma.$queryRawUnsafe(
    `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='Source'`
  )
  console.log('RLS:', rls)

  const policies = await prisma.$queryRawUnsafe(
    `SELECT policyname, cmd FROM pg_policies WHERE tablename='Source' ORDER BY policyname`
  )
  console.log('Policies:', policies)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
