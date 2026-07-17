-- Adds the Device table for iOS push-notification registration.
-- Applied manually via the pooled connection (prisma db push uses DIRECT_URL,
-- which is unreachable from this environment). Column/constraint/index names
-- match Prisma's conventions so `prisma db push` sees the schema as in sync.

CREATE TABLE IF NOT EXISTS "Device" (
  "id" TEXT NOT NULL,
  "expoPushToken" TEXT NOT NULL,
  "platform" TEXT NOT NULL DEFAULT 'ios',
  "appVersion" TEXT,
  "wantsDailyTonight" BOOLEAN NOT NULL DEFAULT true,
  "wantsAlerts" BOOLEAN NOT NULL DEFAULT true,
  "alertMinSeverity" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Device_expoPushToken_key" ON "Device"("expoPushToken");
CREATE INDEX IF NOT EXISTS "Device_isActive_idx" ON "Device"("isActive");
