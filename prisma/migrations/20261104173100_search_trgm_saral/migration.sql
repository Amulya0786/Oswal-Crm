-- One statement so Prisma 6 does not wrap a transaction. CREATE INDEX CONCURRENTLY cannot run inside one.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Complaint_saral_trgm_idx" ON "Complaint" USING gin ("saralId" gin_trgm_ops);
