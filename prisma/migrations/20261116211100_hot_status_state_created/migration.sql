-- One statement so Prisma can run CREATE INDEX CONCURRENTLY outside a transaction.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Complaint_status_stateId_createdAt_idx" ON "Complaint"("status", "stateId", "createdAt");
