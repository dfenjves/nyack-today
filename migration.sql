-- Create SubmissionStatus enum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Create EventSubmission table
CREATE TABLE "EventSubmission" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "venue" TEXT NOT NULL,
    "submitterEmail" TEXT NOT NULL,
    "description" TEXT,
    "endDate" TIMESTAMP(3),
    "address" TEXT,
    "city" TEXT NOT NULL DEFAULT 'Nyack',
    "category" "Category" NOT NULL DEFAULT 'OTHER',
    "price" TEXT,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "isFamilyFriendly" BOOLEAN NOT NULL DEFAULT false,
    "sourceUrl" TEXT,
    "imageUrl" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "approvedEventId" TEXT,

    CONSTRAINT "EventSubmission_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on approvedEventId
CREATE UNIQUE INDEX "EventSubmission_approvedEventId_key" ON "EventSubmission"("approvedEventId");

-- Create indexes
CREATE INDEX "EventSubmission_status_idx" ON "EventSubmission"("status");
CREATE INDEX "EventSubmission_submittedAt_idx" ON "EventSubmission"("submittedAt");

-- Add foreign key constraint
ALTER TABLE "EventSubmission" ADD CONSTRAINT "EventSubmission_approvedEventId_fkey"
    FOREIGN KEY ("approvedEventId") REFERENCES "Event"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
