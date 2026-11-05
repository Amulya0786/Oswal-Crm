ALTER TABLE "Complaint" ADD COLUMN "feedbackPending" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Complaint" ADD COLUMN "closeLat" DOUBLE PRECISION;
ALTER TABLE "Complaint" ADD COLUMN "closeLng" DOUBLE PRECISION;
ALTER TABLE "Complaint" ADD COLUMN "closeDistanceKm" DOUBLE PRECISION;
ALTER TABLE "Complaint" ADD COLUMN "gpsFar" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Complaint" ADD COLUMN "aiSummary" TEXT;
CREATE INDEX "Complaint_feedbackPending_idx" ON "Complaint"("feedbackPending");

CREATE TABLE "VoiceNote" (
  "id" TEXT NOT NULL,
  "complaintId" TEXT NOT NULL,
  "actorId" TEXT,
  "lang" TEXT NOT NULL DEFAULT 'en',
  "path" TEXT NOT NULL,
  "transcript" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'mock',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VoiceNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VoiceNote_complaintId_createdAt_idx" ON "VoiceNote"("complaintId", "createdAt");
ALTER TABLE "VoiceNote" ADD CONSTRAINT "VoiceNote_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProofRule" (
  "callType" TEXT NOT NULL,
  "requirePhoto" BOOLEAN NOT NULL DEFAULT true,
  "requireIdentity" BOOLEAN NOT NULL DEFAULT true,
  "requireGps" BOOLEAN NOT NULL DEFAULT true,
  "maxKm" DOUBLE PRECISION NOT NULL DEFAULT 15,
  CONSTRAINT "ProofRule_pkey" PRIMARY KEY ("callType")
);
