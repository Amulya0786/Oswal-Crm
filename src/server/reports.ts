import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { scopeSql } from "./scope";
import type { ComplaintFilters, SessionUser } from "@/lib/types";
import { istMidnight, midnightShift } from "@/lib/time";
import { labelOf, STATUSES, CALL_TYPES } from "@/lib/labels";

export const REPORTS = [
  { slug: "employee-work", title: "Employee work summary", kind: "aggregate" as const, blurb: "What each technician is carrying and closing." },
  { slug: "complaint-summary", title: "Complaint summary", kind: "aggregate" as const, blurb: "Status by call type." },
  { slug: "msedcl", title: "MSEDCL complaint details", kind: "rows" as const, blurb: "Scheme, Saral and consumer numbers." },
  { slug: "technician", title: "Technician-wise call details", kind: "rows" as const, blurb: "Every complaint behind a technician." },
  { slug: "category", title: "Category-wise call details", kind: "aggregate" as const, blurb: "Volume by product category." },
  { slug: "nature", title: "Nature-wise call details", kind: "aggregate" as const, blurb: "Why customers called." },
  { slug: "problem", title: "Problem-wise call details", kind: "aggregate" as const, blurb: "What was actually wrong." },
  { slug: "product", title: "Product-wise call details", kind: "aggregate" as const, blurb: "Which pumps and panels come back." },
  { slug: "state-count", title: "State ticket count", kind: "aggregate" as const, blurb: "Tickets by state." },
  { slug: "brand-count", title: "Brand ticket count", kind: "aggregate" as const, blurb: "Tickets by OEM / brand." },
  { slug: "missing-serial", title: "Missing serial", kind: "rows" as const, blurb: "Tickets closed or still open with no serial number." },
  { slug: "repeat-rate", title: "Repeat complaint rate", kind: "aggregate" as const, blurb: "Repeat failures within 90 days, by product, model, technician and district." },
  { slug: "repeat-customers", title: "Customers with 3+ complaints", kind: "aggregate" as const, blurb: "People who keep coming back." },
  { slug: "mtbf", title: "Mean time between failures", kind: "aggregate" as const, blurb: "Average days between complaints on the same installed product." },
  { slug: "reopen-technicians", title: "Closures that reopen", kind: "aggregate" as const, blurb: "Technicians whose closures are followed by another complaint within 30 days." },
  { slug: "first-time-fix", title: "First-time fix", kind: "aggregate" as const, blurb: "Share of closures that were not a repeat and did not reopen within 30 days." },
  { slug: "customer-product", title: "Customer product summary", kind: "aggregate" as const, blurb: "Installed products by customer." },
  { slug: "past-service", title: "Equipment past service", kind: "rows" as const, blurb: "Earlier visits for the same serial." },
  { slug: "pending-call-type", title: "Pending by call type", kind: "aggregate" as const, blurb: "Open work split by call type." },
  { slug: "technician-performance", title: "Technician performance", kind: "aggregate" as const, blurb: "Open, closed and overdue work by technician." },
  { slug: "state-district-mis", title: "State and district MIS", kind: "aggregate" as const, blurb: "Open and overdue complaints by state and district." },
];

function dayStart(value?: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  return istMidnight(Number(match[1]), Number(match[2]), Number(match[3]));
}

function reportWhere(user: SessionUser, scope: string, filters: ComplaintFilters, extra?: Prisma.Sql) {
  const parts: Prisma.Sql[] = [scopeSql(user, scope, "c")];
  const from = dayStart(filters.from);
  const to = dayStart(filters.to);
  if (from) parts.push(Prisma.sql`c."bookDate" >= ${from}`);
  if (to) parts.push(Prisma.sql`c."bookDate" < ${midnightShift(to, 1)}`);
  if (filters.stateId) parts.push(Prisma.sql`c."stateId" = ${filters.stateId}`);
  if (filters.status) parts.push(Prisma.sql`c.status = ${filters.status}`);
  if (filters.companyId) parts.push(Prisma.sql`c."companyId" = ${filters.companyId}`);
  if (filters.engineerId) parts.push(Prisma.sql`c."engineerId" = ${filters.engineerId}`);
  if (extra) parts.push(extra);
  return Prisma.join(parts, " AND ");
}

export async function runReport(slug: string, user: SessionUser, scope: string, filters: ComplaintFilters) {
  const meta = REPORTS.find((report) => report.slug === slug);
  if (!meta) return null;
  const page = Math.min(200, Math.max(1, filters.page ?? 1));
  const pageSize = 25;
  if (slug === "employee-work") {
    const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT e.name AS employee, e.kind AS kind, co."shortName" AS company,
        COUNT(*)::int AS tickets,
        COUNT(*) FILTER (WHERE c.status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING'))::int AS live,
        COUNT(*) FILTER (WHERE c.status = 'CLOSED')::int AS closed,
        COUNT(*) FILTER (WHERE c.status = 'HAPPY_CALLING')::int AS happy,
        COUNT(*) FILTER (WHERE c.status = 'CANCELLED')::int AS cancelled,
        ROUND((AVG(EXTRACT(EPOCH FROM (c."closedAt" - c."bookDate")) / 3600) FILTER (WHERE c."closedAt" IS NOT NULL))::numeric, 1) AS mttr_hours
      FROM "Complaint" c
      JOIN "Engineer" e ON e.id = c."engineerId"
      JOIN "Company" co ON co.id = c."companyId"
      WHERE ${reportWhere(user, scope, filters)}
      GROUP BY e.id, e.name, e.kind, co."shortName"
      ORDER BY tickets DESC
      LIMIT 200
    `;
    return { ...meta, columns: cols(["employee", "kind", "company", "tickets", "live", "closed", "happy", "cancelled", "mttr_hours"]), rows: rows.map(stringify), total: rows.length, page: 1, pageSize: rows.length };
  }
  if (slug === "complaint-summary") {
    const rows = await prisma.$queryRaw<{ status: string; callType: string; tickets: number }[]>`
      SELECT c.status, c."callType" AS "callType", COUNT(*)::int AS tickets
      FROM "Complaint" c
      WHERE ${reportWhere(user, scope, filters)}
      GROUP BY 1, 2
      ORDER BY tickets DESC
    `;
    return {
      ...meta,
      columns: cols(["status", "callType", "tickets"]),
      rows: rows.map((row) => ({ status: labelOf(STATUSES, row.status), callType: labelOf(CALL_TYPES, row.callType), tickets: Number(row.tickets) })),
      total: rows.length, page: 1, pageSize: rows.length,
    };
  }
  if (slug === "state-count" || slug === "brand-count" || slug === "category" || slug === "nature" || slug === "problem" || slug === "product") {
    const spec = {
      "state-count": { label: Prisma.raw(`COALESCE(c."stateName", 'Unknown')`), name: "state" },
      "brand-count": { label: Prisma.raw(`COALESCE(c."brandName", 'Unspecified')`), name: "brand" },
      category: { label: Prisma.raw(`COALESCE(c."categoryName", 'Unspecified')`), name: "category" },
      nature: { label: Prisma.raw(`COALESCE(c."natureText", 'Unspecified')`), name: "nature" },
      problem: { label: Prisma.raw(`COALESCE(c."actualProblem", 'Not recorded')`), name: "problem" },
      product: { label: Prisma.raw(`COALESCE(c."productDetails", 'Unspecified')`), name: "product" },
    }[slug]!;
    const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT ${spec.label} AS label,
        COUNT(*)::int AS tickets,
        COUNT(*) FILTER (WHERE c.status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING'))::int AS pending,
        COUNT(*) FILTER (WHERE c.status IN ('CLOSED','HAPPY_CALLING'))::int AS closed,
        ROUND((AVG(EXTRACT(EPOCH FROM (c."closedAt" - c."bookDate")) / 3600) FILTER (WHERE c."closedAt" IS NOT NULL))::numeric, 1) AS mttr_hours
      FROM "Complaint" c
      WHERE ${reportWhere(user, scope, filters)}
      GROUP BY 1
      ORDER BY tickets DESC
      LIMIT 200
    `;
    const shaped = rows.map((row) => ({ [spec.name]: String(row.label), tickets: Number(row.tickets), pending: Number(row.pending), closed: Number(row.closed), mttr_hours: row.mttr_hours == null ? "" : Number(row.mttr_hours) }));
    return { ...meta, columns: cols([spec.name, "tickets", "pending", "closed", "mttr_hours"]), rows: shaped, total: shaped.length, page: 1, pageSize: shaped.length };
  }
  if (slug === "repeat-rate") {
    const where = reportWhere(user, scope, filters);
    const slices = [
      { slice: "Product", label: Prisma.raw(`COALESCE(c."categoryName", 'Unspecified')`) },
      { slice: "Model", label: Prisma.raw(`COALESCE(c."productDetails", 'Unspecified')`) },
      { slice: "Technician", label: Prisma.raw(`COALESCE(c."assignedName", 'Unassigned')`) },
      { slice: "District", label: Prisma.raw(`COALESCE(c."districtName", 'Unknown')`) },
    ];
    const rows = [];
    for (const slice of slices) {
      const part = await prisma.$queryRaw<{ label: string; tickets: number; repeats: number; rate: number | null }[]>`
        SELECT ${slice.label} AS label,
          COUNT(*)::int AS tickets,
          COUNT(*) FILTER (WHERE c."repeatWindow" IS NOT NULL)::int AS repeats,
          ROUND((100.0 * COUNT(*) FILTER (WHERE c."repeatWindow" IS NOT NULL) / NULLIF(COUNT(*), 0))::numeric, 1) AS rate
        FROM "Complaint" c
        WHERE ${where}
        GROUP BY 1
        ORDER BY repeats DESC, tickets DESC
        LIMIT 40
      `;
      rows.push(...part.map((row) => ({ slice: slice.slice, label: row.label, tickets: Number(row.tickets), repeats: Number(row.repeats), rate: row.rate == null ? "" : Number(row.rate) })));
    }
    return { ...meta, columns: cols(["slice", "label", "tickets", "repeats", "rate"]), rows, total: rows.length, page: 1, pageSize: rows.length };
  }
  if (slug === "repeat-customers") {
    const where = reportWhere(user, scope, filters);
    const rows = await prisma.$queryRaw<{ customer: string; phone: string; tickets: number; repeats: number }[]>`
      SELECT c."customerName" AS customer, c.phone,
        COUNT(*)::int AS tickets,
        COUNT(*) FILTER (WHERE c."repeatWindow" IS NOT NULL)::int AS repeats
      FROM "Complaint" c
      WHERE ${where} AND c."customerId" IS NOT NULL
      GROUP BY c."customerId", c."customerName", c.phone
      HAVING COUNT(*) >= 3
      ORDER BY tickets DESC
      LIMIT 200
    `;
    return {
      ...meta,
      columns: cols(["customer", "phone", "tickets", "repeats"]),
      rows: rows.map((row) => ({ customer: row.customer, phone: user.role === "TECHNICIAN" ? "••••" : row.phone, tickets: Number(row.tickets), repeats: Number(row.repeats) })),
      total: rows.length, page: 1, pageSize: rows.length,
    };
  }
  if (slug === "mtbf") {
    const where = reportWhere(user, scope, filters);
    const rows = await prisma.$queryRaw<{ product: string; mtbf_days: number | null; intervals: number }[]>`
      WITH gaps AS (
        SELECT COALESCE(c."productDetails", 'Unspecified') AS product,
          EXTRACT(EPOCH FROM (c."bookDate" - LAG(c."bookDate") OVER (PARTITION BY c."assetId" ORDER BY c."bookDate"))) / 86400 AS gap_days
        FROM "Complaint" c
        WHERE ${where} AND c."assetId" IS NOT NULL
      )
      SELECT product, ROUND(AVG(gap_days)::numeric, 1) AS mtbf_days, COUNT(*)::int AS intervals
      FROM gaps
      WHERE gap_days IS NOT NULL
      GROUP BY product
      ORDER BY intervals DESC
      LIMIT 200
    `;
    return {
      ...meta,
      columns: cols(["product", "mtbf_days", "intervals"]),
      rows: rows.map((row) => ({ product: row.product, mtbf_days: row.mtbf_days == null ? "" : Number(row.mtbf_days), intervals: Number(row.intervals) })),
      total: rows.length, page: 1, pageSize: rows.length,
    };
  }
  if (slug === "reopen-technicians") {
    const where = reportWhere(user, scope, filters);
    const rows = await prisma.$queryRaw<{ technician: string; reopened: number }[]>`
      SELECT COALESCE(prev."assignedName", 'Unassigned') AS technician, COUNT(*)::int AS reopened
      FROM "Complaint" c
      JOIN "Complaint" prev ON prev."ticketNo" = c."repeatOfTicket"
      WHERE ${where} AND c."repeatWindow" = 30 AND prev."closedAt" IS NOT NULL
      GROUP BY prev."engineerId", prev."assignedName"
      ORDER BY reopened DESC
      LIMIT 200
    `;
    return {
      ...meta,
      columns: cols(["technician", "reopened"]),
      rows: rows.map((row) => ({ technician: row.technician, reopened: Number(row.reopened) })),
      total: rows.length, page: 1, pageSize: rows.length,
    };
  }
  if (slug === "pending-call-type") {
    const rows = await prisma.$queryRaw<{ callType: string; open: number; overdue: number }[]>`
      SELECT c."callType" AS "callType",
        COUNT(*) FILTER (WHERE c.status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING'))::int AS open,
        COUNT(*) FILTER (WHERE c.status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING') AND c."slaDueAt" IS NOT NULL AND c."slaDueAt" <= NOW())::int AS overdue
      FROM "Complaint" c WHERE ${reportWhere(user, scope, filters)} GROUP BY 1 ORDER BY 2 DESC`;
    return { ...meta, columns: cols(["callType", "open", "overdue"]), rows, total: rows.length, page: 1, pageSize: rows.length };
  }
  if (slug === "technician-performance") {
    const rows = await prisma.$queryRaw<{ technician: string; open: number; closed: number; overdue: number }[]>`
      SELECT COALESCE(NULLIF(btrim(c."assignedName"), ''), 'Unassigned') AS technician,
        COUNT(*) FILTER (WHERE c.status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING'))::int AS open,
        COUNT(*) FILTER (WHERE c.status IN ('CLOSED','HAPPY_CALLING'))::int AS closed,
        COUNT(*) FILTER (WHERE c.status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING') AND c."slaDueAt" IS NOT NULL AND c."slaDueAt" <= NOW())::int AS overdue
      FROM "Complaint" c WHERE ${reportWhere(user, scope, filters)} GROUP BY 1 ORDER BY 2 DESC LIMIT 200`;
    return { ...meta, columns: cols(["technician", "open", "closed", "overdue"]), rows, total: rows.length, page: 1, pageSize: rows.length };
  }
  if (slug === "state-district-mis") {
    const rows = await prisma.$queryRaw<{ state: string; district: string; open: number; overdue: number }[]>`
      SELECT COALESCE(c."stateName", 'Unknown') AS state, COALESCE(c."districtName", 'Unknown') AS district,
        COUNT(*) FILTER (WHERE c.status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING'))::int AS open,
        COUNT(*) FILTER (WHERE c.status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING') AND c."slaDueAt" IS NOT NULL AND c."slaDueAt" <= NOW())::int AS overdue
      FROM "Complaint" c WHERE ${reportWhere(user, scope, filters)} GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 300`;
    return { ...meta, columns: cols(["state", "district", "open", "overdue"]), rows, total: rows.length, page: 1, pageSize: rows.length };
  }
  if (slug === "customer-product") {
    const rows = await prisma.$queryRaw<{ customer: string; product: string; n: number }[]>`
      SELECT c."customerName" AS customer, COALESCE(c."productDetails", 'Unknown') AS product, COUNT(*)::int AS n
      FROM "Complaint" c WHERE ${reportWhere(user, scope, filters)} GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 200`;
    return { ...meta, columns: cols(["customer", "product", "n"]), rows: rows.map((row) => ({ ...row })), total: rows.length, page: 1, pageSize: rows.length };
  }
  if (slug === "past-service") {
    const rows = await prisma.$queryRaw<{ serial: string; tickets: number; last: Date }[]>`
      SELECT c."serialNorm" AS serial, COUNT(*)::int AS tickets, MAX(c."bookDate") AS last
      FROM "Complaint" c WHERE ${reportWhere(user, scope, filters)} AND c."serialNorm" IS NOT NULL
      GROUP BY 1 HAVING COUNT(*) > 1 ORDER BY 2 DESC LIMIT 200`;
    return { ...meta, columns: cols(["serial", "tickets", "last"]), rows: rows.map((row) => ({ serial: row.serial, tickets: row.tickets, last: String(row.last) })), total: rows.length, page: 1, pageSize: rows.length };
  }
  if (slug === "first-time-fix") {
    const where = reportWhere(user, scope, filters);
    const rows = await prisma.$queryRaw<{ fixed: number; not_fixed: number; unknown: number; first_time_fix_pct: number | null }[]>`
      SELECT
        COUNT(*) FILTER (WHERE c."firstTimeFix" IS TRUE)::int AS fixed,
        COUNT(*) FILTER (WHERE c."firstTimeFix" IS FALSE)::int AS not_fixed,
        COUNT(*) FILTER (WHERE c."firstTimeFix" IS NULL)::int AS unknown,
        ROUND((100.0 * COUNT(*) FILTER (WHERE c."firstTimeFix" IS TRUE) / NULLIF(COUNT(*) FILTER (WHERE c."firstTimeFix" IS NOT NULL), 0))::numeric, 1) AS first_time_fix_pct
      FROM "Complaint" c
      WHERE ${where} AND c.status IN ('CLOSED', 'HAPPY_CALLING', 'CLOSED_UNVERIFIED')
    `;
    const row = rows[0];
    const shaped = [{
      fixed: Number(row?.fixed ?? 0),
      not_fixed: Number(row?.not_fixed ?? 0),
      unknown: Number(row?.unknown ?? 0),
      first_time_fix_pct: row?.first_time_fix_pct == null ? "" : Number(row.first_time_fix_pct),
    }];
    return { ...meta, columns: cols(["fixed", "not_fixed", "unknown", "first_time_fix_pct"]), rows: shaped, total: 1, page: 1, pageSize: 1 };
  }
  const extra = slug === "msedcl"
    ? Prisma.sql`(c."saralId" IS NOT NULL OR c."schemeName" IS NOT NULL OR c."callType" = 'SCHEME')`
    : slug === "missing-serial"
      ? Prisma.sql`c."serialNorm" IS NULL`
      : Prisma.sql`TRUE`;
  const where = reportWhere(user, scope, filters, extra);
  const count = await prisma.$queryRaw<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM "Complaint" c WHERE ${where}`;
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT c."ticketNo", c."bookDate", c."customerName", c.phone, c."stateName", c."districtName", c."callType",
           c."productDetails", c."natureText", c."assignedName", c.status, c."saralId", c."brandName",
           c."msedclConsumerNo", c."schemeName", c.priority, c."finalStatus"
    FROM "Complaint" c
    WHERE ${where}
    ORDER BY c."bookDate" DESC
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
  `;
  return {
    ...meta,
    columns: cols(["ticketNo", "bookDate", "customerName", "phone", "districtName", "stateName", "callType", "productDetails", "natureText", "assignedName", "status", "saralId", "brandName", "schemeName", "msedclConsumerNo", "priority"]),
    rows: rows.map((row) => ({
      ...stringify(row),
      status: labelOf(STATUSES, String(row.status)),
      callType: labelOf(CALL_TYPES, String(row.callType)),
      phone: user.role === "TECHNICIAN" ? "••••" : String(row.phone ?? ""),
    })),
    total: Number(count[0]?.n ?? 0),
    page,
    pageSize,
  };
}

function cols(keys: string[]) {
  const labels: Record<string, string> = {
    employee: "Employee", kind: "Kind", company: "Company", tickets: "Tickets", live: "Live", closed: "Closed",
    happy: "Happy calling", cancelled: "Cancelled", mttr_hours: "MTTR hours", status: "Status", callType: "Call type",
    state: "State", brand: "OEM / brand", category: "Category", nature: "Nature", problem: "Actual problem",
    product: "Product", pending: "Pending", ticketNo: "Comp. No", bookDate: "Book date", customerName: "Customer",
    phone: "Mobile", districtName: "District", stateName: "State", productDetails: "Product", natureText: "Nature",
    assignedName: "Assigned to", saralId: "Saral Id", brandName: "OEM / brand", schemeName: "Scheme",
    msedclConsumerNo: "MSEDCL consumer", priority: "Priority",
    slice: "Breakdown", label: "Name", repeats: "Repeat failures", rate: "Repeat rate %",
    customer: "Customer", mtbf_days: "MTBF days", intervals: "Intervals",
    technician: "Technician", reopened: "Reopened within 30 days",
    fixed: "First-time fix", not_fixed: "Not first-time", unknown: "Not scored yet", first_time_fix_pct: "First-time fix %",
  };
  return keys.map((key) => ({ key, label: labels[key] ?? key }));
}

function stringify(row: Record<string, unknown>) {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) out[key] = value.toISOString();
    else if (value == null) out[key] = "";
    else if (typeof value === "bigint") out[key] = Number(value);
    else if (typeof value === "object") out[key] = JSON.stringify(value);
    else out[key] = value as string | number;
  }
  return out;
}
