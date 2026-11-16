CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Complaint_company_state_status_idx" ON "Complaint" ("companyId", "stateId", "status");
CREATE INDEX IF NOT EXISTS "Complaint_engineer_book_idx" ON "Complaint" ("engineerId", "bookDate");
CREATE INDEX IF NOT EXISTS "Complaint_brand_book_idx" ON "Complaint" ("brandId", "bookDate");
CREATE INDEX IF NOT EXISTS "Complaint_phone_prefix_idx" ON "Complaint" ("phone" varchar_pattern_ops);
CREATE INDEX IF NOT EXISTS "Complaint_ticket_prefix_idx" ON "Complaint" ("ticketNo" varchar_pattern_ops);
CREATE INDEX IF NOT EXISTS "Complaint_phone_trgm_idx" ON "Complaint" USING gin ("phone" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Complaint_name_trgm_idx" ON "Complaint" USING gin ("customerName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Complaint_serial_trgm_idx" ON "Complaint" USING gin ("serialNorm" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Customer_phone_trgm_idx" ON "Customer" USING gin ("phone" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Customer_name_trgm_idx" ON "Customer" USING gin ("name" gin_trgm_ops);
