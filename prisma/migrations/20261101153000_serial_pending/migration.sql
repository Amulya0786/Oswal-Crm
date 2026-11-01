ALTER TABLE "Complaint" ADD COLUMN "serialPending" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Complaint" ADD COLUMN "serialUnavailableReason" TEXT;
ALTER TABLE "Complaint" ADD COLUMN "missingSerialReason" TEXT;
ALTER TABLE "Complaint" ADD COLUMN "nameplatePhoto" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Complaint" ADD COLUMN "serialCustomerMismatch" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Complaint_serialPending_status_idx" ON "Complaint"("serialPending", "status");
