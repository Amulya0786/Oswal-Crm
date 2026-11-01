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
