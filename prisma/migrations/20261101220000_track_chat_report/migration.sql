ALTER TABLE "Complaint" ADD COLUMN "trackToken" TEXT;
CREATE UNIQUE INDEX "Complaint_trackToken_key" ON "Complaint"("trackToken");

CREATE TABLE "WhatsAppSession" (
  "phone" TEXT NOT NULL,
  "lang" TEXT NOT NULL DEFAULT 'en',
  "step" TEXT NOT NULL DEFAULT 'menu',
  "draft" TEXT NOT NULL DEFAULT '{}',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppSession_pkey" PRIMARY KEY ("phone")
);

CREATE TABLE "Callback" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "name" TEXT,
  "note" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Callback_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Callback_status_createdAt_idx" ON "Callback"("status", "createdAt");

CREATE TABLE "ReportKey" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "ReportKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReportKey_keyHash_key" ON "ReportKey"("keyHash");
