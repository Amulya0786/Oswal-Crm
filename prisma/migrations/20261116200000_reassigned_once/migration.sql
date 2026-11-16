ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "reassignedOnce" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Complaint" c
SET "reassignedOnce" = true
WHERE c.status = 'REASSIGNED'
   OR EXISTS (
     SELECT 1 FROM "ComplaintEvent" e
     WHERE e."complaintId" = c.id AND e.type = 'REASSIGNED'
   );

CREATE INDEX IF NOT EXISTS "Complaint_reassignedOnce_status_idx" ON "Complaint" ("reassignedOnce", "status");
