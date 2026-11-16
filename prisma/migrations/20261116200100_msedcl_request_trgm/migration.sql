-- One statement so Prisma 6 does not wrap a transaction.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Complaint_msedcl_request_trgm_idx" ON "Complaint" USING gin ("msedclRequestNo" gin_trgm_ops);
