-- portalNo already has a btree index and a trigram index. This one serves the default "hide archived" filter together with a portal number lookup.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Complaint_archived_portalNo_idx" ON "Complaint"("archived", "portalNo");
