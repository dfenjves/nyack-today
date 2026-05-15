-- Performance improvement: composite index on the most common query pattern
-- WHERE isHidden = false AND startDate >= ?
-- Run with: psql $DATABASE_URL -f prisma/add_composite_index.sql
-- OR run: npx prisma db push (if using prisma push workflow)

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Event_isHidden_startDate_idx"
  ON "Event"("isHidden", "startDate");

SELECT 'Composite index created!' as status;
