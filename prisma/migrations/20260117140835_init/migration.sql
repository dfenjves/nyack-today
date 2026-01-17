-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "venue" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT NOT NULL DEFAULT 'Nyack',
    "isNyackProper" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "price" TEXT,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "isFamilyFriendly" BOOLEAN NOT NULL DEFAULT false,
    "sourceUrl" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "imageUrl" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sourceHash" TEXT
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Nyack',
    "isNyackProper" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "price" TEXT,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "isFamilyFriendly" BOOLEAN NOT NULL DEFAULT false,
    "hours" TEXT,
    "websiteUrl" TEXT NOT NULL,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ScraperLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "eventsFound" INTEGER NOT NULL DEFAULT 0,
    "eventsAdded" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "runAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_sourceHash_key" ON "Event"("sourceHash");

-- CreateIndex
CREATE INDEX "Event_startDate_idx" ON "Event"("startDate");

-- CreateIndex
CREATE INDEX "Event_category_idx" ON "Event"("category");

-- CreateIndex
CREATE INDEX "Event_isHidden_idx" ON "Event"("isHidden");

-- CreateIndex
CREATE INDEX "Event_isFamilyFriendly_idx" ON "Event"("isFamilyFriendly");

-- CreateIndex
CREATE INDEX "Activity_category_idx" ON "Activity"("category");

-- CreateIndex
CREATE INDEX "Activity_isActive_idx" ON "Activity"("isActive");

-- CreateIndex
CREATE INDEX "Activity_isFamilyFriendly_idx" ON "Activity"("isFamilyFriendly");

-- CreateIndex
CREATE INDEX "ScraperLog_sourceName_idx" ON "ScraperLog"("sourceName");

-- CreateIndex
CREATE INDEX "ScraperLog_runAt_idx" ON "ScraperLog"("runAt");
