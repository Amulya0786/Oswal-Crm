-- One statement so Prisma 6 does not wrap a transaction.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Complaint_portal_no_trgm_idx" ON "Complaint" USING gin ("portalNo" gin_trgm_ops);
