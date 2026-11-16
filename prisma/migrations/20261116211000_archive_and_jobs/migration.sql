-- Closed tickets older than a year stay in Complaint and drop out of the default lists.
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

UPDATE "Complaint"
SET "archived" = true,
    "archivedAt" = COALESCE("closedAt", "cancelledAt", "updatedAt")
WHERE "archived" = false
  AND status IN ('CLOSED', 'CLOSED_UNVERIFIED', 'HAPPY_CALLING', 'CANCELLED')
  AND COALESCE("closedAt", "cancelledAt") < NOW() - INTERVAL '12 months';

CREATE TABLE IF NOT EXISTS "BackgroundJob" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BackgroundJob_status_runAt_idx" ON "BackgroundJob"("status", "runAt");
CREATE INDEX IF NOT EXISTS "BackgroundJob_kind_status_idx" ON "BackgroundJob"("kind", "status");
CREATE INDEX IF NOT EXISTS "LoginHistory_ip_at_idx" ON "LoginHistory"("ip", "at");
