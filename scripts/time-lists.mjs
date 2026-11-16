import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seed(companyId) {
  const existing = await prisma.complaint.count({ where: { ticketNo: { startsWith: "PERF" } } });
  if (existing >= 3000) return existing;
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Complaint" ("id","ticketNo","companyId","bookDate","customerName","phone","status","callType","excludeFromMis","productDetails","updatedAt")
    SELECT 'perf' || g, 'PERF' || lpad(g::text, 6, '0'), '${companyId}', NOW() - (g || ' minutes')::interval,
           'Customer ' || g, '9' || lpad((g % 1000000000)::text, 9, '0'), 'OPEN', 'BREAKDOWN', false, 'Pump', NOW()
    FROM generate_series(${existing}, 2999) g
  `);
  return 3000;
}

async function time(label) {
  const listStart = performance.now();
  await prisma.$queryRaw`SELECT "id","ticketNo","customerName","phone","status","bookDate" FROM "Complaint" WHERE "excludeFromMis" = false ORDER BY "bookDate" DESC, "id" DESC LIMIT 50`;
  const listMs = performance.now() - listStart;
  const dashStart = performance.now();
  await prisma.$queryRaw`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING'))::int AS pending,
      COUNT(*) FILTER (WHERE status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING') AND "slaDueAt" IS NOT NULL AND "slaDueAt" <= NOW())::int AS overdue
    FROM "Complaint" WHERE "excludeFromMis" = false`;
  const dashMs = performance.now() - dashStart;
  console.log(`${label} list_ms=${listMs.toFixed(1)} dashboard_ms=${dashMs.toFixed(1)}`);
}

const company = await prisma.company.findFirst();
if (!company) {
  console.log("no company");
  process.exit(0);
}
await seed(company.id);
await time("before");
await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Complaint_phone_trgm_idx" ON "Complaint" USING gin ("phone" gin_trgm_ops)`);
await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Complaint_name_trgm_idx" ON "Complaint" USING gin ("customerName" gin_trgm_ops)`);
await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Complaint_company_state_status_idx" ON "Complaint" ("companyId", "stateId", "status")`);
await prisma.$executeRawUnsafe(`ANALYZE "Complaint"`);
await time("after");
await prisma.$executeRawUnsafe(`DELETE FROM "Complaint" WHERE "ticketNo" LIKE 'PERF%'`);
await prisma.$disconnect();
