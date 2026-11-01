import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { filterSql, riskPredicate, scopeSql, type RiskContext } from "./scope";
import { ACTIVE } from "./scope";
import type { ComplaintFilters, SessionUser } from "@/lib/types";
import { CALL_TYPES, labelOf } from "@/lib/labels";
import { ageDays, kolkataMonthStart, kolkataNextMonthStart, kolkataTodayStart, kolkataYmd, midnightShift, shiftYmd } from "@/lib/time";
import { assessSla } from "@/lib/sla";
import { displayPhone } from "@/lib/mask";

const SORTS = new Set(["bookDate", "ticketNo", "status", "priority", "customerName", "slaDueAt", "updatedAt"]);

let signalCache: { at: number; loadIds: string[]; loadCounts: Map<string, number>; hist: Record<string, number> } | null = null;

export async function loadRiskContext(now = new Date()): Promise<RiskContext> {
  if (!process.env.VITEST && signalCache && Date.now() - signalCache.at < 60_000) {
    return { now, ...signalCache };
  }
  const since = new Date(now.getTime() - 180 * 86400000);
  const [loads, histRows] = await Promise.all([
    prisma.$queryRaw<{ id: string; n: number }[]>`
      SELECT "engineerId" AS id, COUNT(*)::int AS n
      FROM "Complaint"
      WHERE status IN (${Prisma.join(ACTIVE)}) AND "engineerId" IS NOT NULL
      GROUP BY "engineerId"
    `,
    prisma.$queryRaw<{ call: string; hours: number | null }[]>`
      SELECT "callType" AS call, AVG(EXTRACT(EPOCH FROM ("closedAt" - "bookDate")) / 3600) AS hours
      FROM "Complaint"
      WHERE status IN ('CLOSED', 'HAPPY_CALLING') AND "closedAt" IS NOT NULL AND "closedAt" >= ${since}
      GROUP BY "callType"
    `,
  ]);
  const loadCounts = new Map<string, number>();
  const loadIds: string[] = [];
  for (const row of loads) {
    const n = Number(row.n);
    if (!row.id) continue;
    loadCounts.set(row.id, n);
    if (n >= 10) loadIds.push(row.id);
  }
  const hist: Record<string, number> = {};
  for (const row of histRows) if (row.hours != null) hist[row.call] = Number(row.hours);
  const snapshot = { loadIds, loadCounts, hist };
  if (!process.env.VITEST) signalCache = { at: Date.now(), ...snapshot };
  return { now, ...snapshot };
}

export function clearSignalCache() {
  signalCache = null;
}

type RawRow = {
  id: string;
  ticketNo: string;
  bookDate: Date;
  customerName: string;
  phone: string;
  districtName: string | null;
  stateName: string | null;
  callType: string;
  productDetails: string | null;
  natureText: string | null;
  assignedName: string | null;
  status: string;
  priority: string;
  companyId: string;
  saralId: string | null;
  engineerId: string | null;
  finalStatus: string | null;
  scheduleDate: Date | null;
  brandName: string | null;
  slaDueAt: Date | null;
  serialNo: string | null;
  serialPending: boolean;
  repeatFlag: boolean;
  repeatReason: string | null;
  escalationLevel: number;
  source: string;
  closedAt: Date | null;
  schemeName: string | null;
};

export type ListRow = {
  id: string;
  ticketNo: string;
  bookDate: string;
  customerName: string;
  phone: string;
  districtName: string | null;
  stateName: string | null;
  callType: string;
  productDetails: string | null;
  natureText: string | null;
  assignedName: string | null;
  status: string;
  priority: string;
  companyId: string;
  companyName: string;
  saralId: string | null;
  ageDays: number;
  slaBreached: boolean;
  slaRisk: boolean;
  slaRiskReason: string | null;
  repeatFlag: boolean;
  repeatReason: string | null;
  escalationLevel: number;
  brandName: string | null;
  finalStatus: string | null;
  scheduleDate: string | null;
  source: string;
  serialNo: string | null;
  serialPending: boolean;
  schemeName: string | null;
};

function present(row: RawRow, user: SessionUser, ctx: RiskContext, companies: Map<string, string>): ListRow {
  const signal = assessSla({
    status: row.status,
    bookDate: new Date(row.bookDate),
    slaDueAt: row.slaDueAt ? new Date(row.slaDueAt) : null,
    now: ctx.now,
    engineerOpen: row.engineerId ? ctx.loadCounts.get(row.engineerId) ?? 0 : 0,
    historicalHours: ctx.hist[row.callType] ?? null,
  });
  const end = row.closedAt && !ACTIVE.includes(row.status as (typeof ACTIVE)[number]) ? new Date(row.closedAt) : ctx.now;
  return {
    id: row.id,
    ticketNo: row.ticketNo,
    bookDate: new Date(row.bookDate).toISOString(),
    customerName: row.customerName,
    phone: displayPhone(row.phone, user.role === "TECHNICIAN"),
    districtName: row.districtName,
    stateName: row.stateName,
    callType: row.callType,
    productDetails: row.productDetails,
    natureText: row.natureText,
    assignedName: row.assignedName,
    status: row.status,
    priority: row.priority,
    companyId: row.companyId,
    companyName: companies.get(row.companyId) ?? "",
    saralId: row.saralId,
    ageDays: ageDays(new Date(row.bookDate), end),
    slaBreached: signal.breached,
    slaRisk: signal.risk,
    slaRiskReason: signal.reason,
    repeatFlag: row.repeatFlag,
    repeatReason: row.repeatReason,
    escalationLevel: row.escalationLevel,
    brandName: row.brandName,
    finalStatus: row.finalStatus,
    scheduleDate: row.scheduleDate ? new Date(row.scheduleDate).toISOString() : null,
    source: row.source,
    serialNo: row.serialNo,
    serialPending: Boolean(row.serialPending),
    schemeName: row.schemeName,
  };
}

const LIST_COLUMNS = Prisma.raw(`
  "id", "ticketNo", "bookDate", "customerName", "phone", "districtName", "stateName",
  "callType", "productDetails", "natureText", "assignedName", "status", "priority",
  "companyId", "saralId", "engineerId", "finalStatus", "scheduleDate", "brandName",
  "slaDueAt", "serialNo", "serialPending", "repeatFlag", "repeatReason", "escalationLevel", "source",
  "closedAt", "schemeName"
`);

export async function listComplaints(user: SessionUser, scope: string, filters: ComplaintFilters, now = new Date()) {
  const ctx = await loadRiskContext(now);
  const where = Prisma.sql`${scopeSql(user, scope)} AND ${filterSql(filters, ctx)}`;
  const sort = SORTS.has(filters.sort ?? "") ? filters.sort! : "bookDate";
  const dir = filters.dir === "asc" ? "ASC" : "DESC";
  const order = Prisma.raw(`"${sort}" ${dir}, "id" ${dir}`);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 25));
  const requested = filters.page ?? 1;
  const page = Math.min(200, Math.max(1, requested));
  const skip = (page - 1) * pageSize;
  const [countRows, rows, companies] = await Promise.all([
    prisma.$queryRaw<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM "Complaint" WHERE ${where}`,
    prisma.$queryRaw<RawRow[]>`
      SELECT ${LIST_COLUMNS}
      FROM "Complaint"
      WHERE ${where}
      ORDER BY ${order}
      LIMIT ${pageSize} OFFSET ${skip}
    `,
    prisma.company.findMany({ select: { id: true, shortName: true } }),
  ]);
  const names = new Map(companies.map((company) => [company.id, company.shortName]));
  return {
    rows: rows.map((row) => present(row, user, ctx, names)),
    total: Number(countRows[0]?.n ?? 0),
    page,
    pageSize,
    capped: requested > 200,
  };
}

export type Tile = {
  key: string;
  label: string;
  value: number;
  href: string;
  tone: string;
  hint: string;
  group: "pipeline" | "type" | "month" | "today" | "age" | "sla" | "feedback";
};

export type SerialGap = { label: string; total: number; missing: number; percent: number };

export type DashboardData = {
  tiles: Tile[];
  drill: { dimension: string; rows: { label: string; value: number; href: string }[] };
  trend: { date: string; logged: number; closed: number }[];
  recent: { id: string; ticketNo: string; customerName: string; status: string; callType: string; districtName: string | null; bookDate: string; companyName: string }[];
  companies: { id: string; shortName: string; accent: string; active: number }[];
  serialGap: { total: number; missing: number; percent: number; byState: SerialGap[]; byTechnician: SerialGap[]; bySource: SerialGap[] };
};

const dashCache = new Map<string, DashboardData>();
const inflight = new Map<string, Promise<DashboardData>>();

function tileHref(filters: ComplaintFilters, extra: Record<string, string>) {
  const params = new URLSearchParams();
  for (const key of ["stateId", "districtId", "engineerId", "productId", "callType", "companyId"] as const) {
    if (filters[key]) params.set(key, String(filters[key]));
  }
  for (const [key, value] of Object.entries(extra)) if (value) params.set(key, value);
  const qs = params.toString();
  return qs ? `/complaints?${qs}` : "/complaints";
}

function dayKey(value: unknown) {
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

async function computeDashboard(user: SessionUser, scope: string, filters: ComplaintFilters, dimension: string, now: Date): Promise<DashboardData> {
  const ctx = await loadRiskContext(now);
  const drill: ComplaintFilters = {
    stateId: filters.stateId,
    districtId: filters.districtId,
    engineerId: filters.engineerId,
    productId: filters.productId,
    callType: filters.callType,
    companyId: filters.companyId,
  };
  const where = Prisma.sql`${scopeSql(user, scope)} AND ${filterSql(drill, ctx)}`;
  const monthStart = kolkataMonthStart(now);
  const nextMonth = kolkataNextMonthStart(now);
  const today = kolkataTodayStart(now);
  const tomorrow = midnightShift(now, 1);
  const age02 = { gte: midnightShift(now, -2), lt: tomorrow };
  const age37 = { gte: midnightShift(now, -7), lt: midnightShift(now, -2) };
  const age815 = { gte: midnightShift(now, -15), lt: midnightShift(now, -7) };
  const age15 = midnightShift(now, -15);
  const risk = riskPredicate(ctx);
  const active = Prisma.join(ACTIVE);
  const counts = await prisma.$queryRaw<Record<string, number>[]>`
    SELECT
      COUNT(*) FILTER (WHERE status IN (${active}))::int AS active,
      COUNT(*) FILTER (WHERE status = 'OPEN')::int AS open,
      COUNT(*) FILTER (WHERE status = 'ASSIGNED')::int AS assigned,
      COUNT(*) FILTER (WHERE status = 'REASSIGNED')::int AS reassigned,
      COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
      COUNT(*) FILTER (WHERE status IN (${active}) AND "callType" = 'BREAKDOWN')::int AS breakdown,
      COUNT(*) FILTER (WHERE status IN (${active}) AND "callType" = 'INSTALLATION')::int AS installation,
      COUNT(*) FILTER (WHERE status IN (${active}) AND "callType" = 'INSURANCE')::int AS insurance,
      COUNT(*) FILTER (WHERE status IN (${active}) AND "callType" = 'MOBILE_APP')::int AS mobile,
      COUNT(*) FILTER (WHERE status IN (${active}) AND "callType" = 'SCHEME')::int AS scheme,
      COUNT(*) FILTER (WHERE "bookDate" >= ${monthStart} AND "bookDate" < ${nextMonth})::int AS logged_month,
      COUNT(*) FILTER (WHERE status = 'CLOSED' AND "closedAt" >= ${monthStart} AND "closedAt" < ${nextMonth})::int AS closed_month,
      COUNT(*) FILTER (WHERE status = 'HAPPY_CALLING' AND "happyAt" >= ${monthStart} AND "happyAt" < ${nextMonth})::int AS happy_month,
      COUNT(*) FILTER (WHERE status = 'CANCELLED' AND "cancelledAt" >= ${monthStart} AND "cancelledAt" < ${nextMonth})::int AS cancel_month,
      COUNT(*) FILTER (WHERE "bookDate" >= ${today} AND "bookDate" < ${tomorrow})::int AS logged_today,
      COUNT(*) FILTER (WHERE status = 'CLOSED' AND "closedAt" >= ${today} AND "closedAt" < ${tomorrow})::int AS closed_today,
      COUNT(*) FILTER (WHERE status = 'HAPPY_CALLING' AND "happyAt" >= ${today} AND "happyAt" < ${tomorrow})::int AS happy_today,
      COUNT(*) FILTER (WHERE status = 'CANCELLED' AND "cancelledAt" >= ${today} AND "cancelledAt" < ${tomorrow})::int AS cancel_today,
      COUNT(*) FILTER (WHERE status IN (${active}) AND "bookDate" >= ${age02.gte} AND "bookDate" < ${age02.lt})::int AS age_0_2,
      COUNT(*) FILTER (WHERE status IN (${active}) AND "bookDate" >= ${age37.gte} AND "bookDate" < ${age37.lt})::int AS age_3_7,
      COUNT(*) FILTER (WHERE status IN (${active}) AND "bookDate" >= ${age815.gte} AND "bookDate" < ${age815.lt})::int AS age_8_15,
      COUNT(*) FILTER (WHERE status IN (${active}) AND "bookDate" < ${age15})::int AS age_15p,
      COUNT(*) FILTER (WHERE status IN (${active}) AND "slaDueAt" IS NOT NULL AND "slaDueAt" <= ${now})::int AS breach,
      COUNT(*) FILTER (WHERE ${risk})::int AS risk,
      COUNT(*) FILTER (WHERE "feedbackPending" = true)::int AS feedback_pending,
      COALESCE(ROUND(AVG("happyRating") FILTER (WHERE "happyRating" IS NOT NULL))::int, 0) AS feedback_score
    FROM "Complaint"
    WHERE ${where}
  `;
  const c = counts[0] ?? {};
  const num = (key: string) => Number(c[key] ?? 0);
  const tiles: Tile[] = [
    { key: "active", group: "pipeline", tone: "navy", label: "All live calls", value: num("active"), hint: "Open, assigned and on hold", href: tileHref(drill, { statusGroup: "active" }) },
    { key: "open", group: "pipeline", tone: "info", label: "Open", value: num("open"), hint: "Not yet assigned", href: tileHref(drill, { status: "OPEN" }) },
    { key: "assigned", group: "pipeline", tone: "copper", label: "Assigned", value: num("assigned"), hint: "With a technician", href: tileHref(drill, { status: "ASSIGNED" }) },
    { key: "pending", group: "pipeline", tone: "amber", label: "Pending", value: num("pending"), hint: "Held with a reason", href: tileHref(drill, { status: "PENDING" }) },
    { key: "reassigned", group: "pipeline", tone: "violet", label: "Re-assigned", value: num("reassigned"), hint: "Moved to another technician", href: tileHref(drill, { status: "REASSIGNED" }) },
    { key: "breakdown", group: "type", tone: "bad", label: "Pending breakdown", value: num("breakdown"), hint: "Live breakdown calls", href: tileHref(drill, { statusGroup: "active", callType: "BREAKDOWN" }) },
    { key: "installation", group: "type", tone: "info", label: "Pending installation", value: num("installation"), hint: "New fitments", href: tileHref(drill, { statusGroup: "active", callType: "INSTALLATION" }) },
    { key: "insurance", group: "type", tone: "copper", label: "Pending insurance", value: num("insurance"), hint: "Survey and claims", href: tileHref(drill, { statusGroup: "active", callType: "INSURANCE" }) },
    { key: "mobile", group: "type", tone: "teal", label: "Pending mobile app", value: num("mobile"), hint: "App complaints", href: tileHref(drill, { statusGroup: "active", callType: "MOBILE_APP" }) },
    { key: "scheme", group: "type", tone: "amber", label: "Pending scheme", value: num("scheme"), hint: "MSEDCL and KUSUM", href: tileHref(drill, { statusGroup: "active", callType: "SCHEME" }) },
    { key: "logged_month", group: "month", tone: "navy", label: "Logged this month", value: num("logged_month"), hint: "Complaints booked", href: tileHref(drill, { booked: "month" }) },
    { key: "closed_month", group: "month", tone: "good", label: "Closed this month", value: num("closed_month"), hint: "Status closed", href: tileHref(drill, { closed: "month" }) },
    { key: "happy_month", group: "month", tone: "teal", label: "Happy call this month", value: num("happy_month"), hint: "Phone feedback done", href: tileHref(drill, { happy: "month" }) },
    { key: "cancel_month", group: "month", tone: "stone", label: "Cancelled", value: num("cancel_month"), hint: "This month", href: tileHref(drill, { cancelled: "month" }) },
    { key: "logged_today", group: "today", tone: "navy", label: "Logged today", value: num("logged_today"), hint: "Since midnight IST", href: tileHref(drill, { booked: "today" }) },
    { key: "closed_today", group: "today", tone: "good", label: "Closed today", value: num("closed_today"), hint: "Closed since midnight", href: tileHref(drill, { closed: "today" }) },
    { key: "happy_today", group: "today", tone: "teal", label: "Happy call", value: num("happy_today"), hint: "Phone feedback today", href: tileHref(drill, { happy: "today" }) },
    { key: "cancel_today", group: "today", tone: "stone", label: "Cancelled today", value: num("cancel_today"), hint: "Cancelled today", href: tileHref(drill, { cancelled: "today" }) },
    { key: "age_0_2", group: "age", tone: "good", label: "0–2 days", value: num("age_0_2"), hint: "Fresh complaints", href: tileHref(drill, { ageing: "0-2" }) },
    { key: "age_3_7", group: "age", tone: "info", label: "3–7 days", value: num("age_3_7"), hint: "Needs a push", href: tileHref(drill, { ageing: "3-7" }) },
    { key: "age_8_15", group: "age", tone: "amber", label: "8–15 days", value: num("age_8_15"), hint: "Ageing", href: tileHref(drill, { ageing: "8-15" }) },
    { key: "age_15p", group: "age", tone: "bad", label: "Over 15 days", value: num("age_15p"), hint: "Older than 15 days", href: tileHref(drill, { ageing: "15p" }) },
    { key: "breach", group: "sla", tone: "bad", label: "SLA breached", value: num("breach"), hint: "Past the promise time", href: tileHref(drill, { breach: "1" }) },
    { key: "risk", group: "sla", tone: "amber", label: "At risk", value: num("risk"), hint: "Likely to breach", href: tileHref(drill, { risk: "1" }) },
    { key: "feedback_score", group: "feedback", tone: "good", label: "WhatsApp rating", value: num("feedback_score"), hint: "Average of 1 to 5", href: "/feedback" },
    { key: "feedback_pending", group: "feedback", tone: "amber", label: "Ratings waiting", value: num("feedback_pending"), hint: "Closed visits with no score yet", href: "/feedback" },
  ];

  const dim = dimension === "district" || dimension === "engineer" || dimension === "product" || dimension === "type" ? dimension : "state";
  const labelExpr =
    dim === "district" ? Prisma.raw(`COALESCE("districtName", 'Unknown')`) :
    dim === "engineer" ? Prisma.raw(`COALESCE("assignedName", 'Unassigned')`) :
    dim === "product" ? Prisma.raw(`COALESCE("productDetails", 'Unspecified')`) :
    dim === "type" ? Prisma.raw(`"callType"`) :
    Prisma.raw(`COALESCE("stateName", 'Unknown')`);
  const idExpr =
    dim === "district" ? Prisma.raw(`COALESCE("districtId", '')`) :
    dim === "engineer" ? Prisma.raw(`COALESCE("engineerId", '')`) :
    dim === "product" ? Prisma.raw(`COALESCE("productId", '')`) :
    dim === "type" ? Prisma.raw(`"callType"`) :
    Prisma.raw(`COALESCE("stateId", '')`);
  const paramKey = dim === "district" ? "districtId" : dim === "engineer" ? "engineerId" : dim === "product" ? "productId" : dim === "type" ? "callType" : "stateId";

  const start = midnightShift(now, -29);
  const [drillRows, loggedRows, closedRows, recentRows, companyRows, companyActive] = await Promise.all([
    prisma.$queryRaw<{ label: string; id: string; n: number }[]>`
      SELECT ${labelExpr} AS label, ${idExpr} AS id, COUNT(*)::int AS n
      FROM "Complaint"
      WHERE ${where} AND status IN (${active})
      GROUP BY 1, 2
      ORDER BY n DESC
      LIMIT 12
    `,
    prisma.$queryRaw<{ d: unknown; n: number }[]>`
      SELECT (("bookDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date AS d, COUNT(*)::int AS n
      FROM "Complaint" WHERE ${where} AND "bookDate" >= ${start}
      GROUP BY 1
    `,
    prisma.$queryRaw<{ d: unknown; n: number }[]>`
      SELECT (("closedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date AS d, COUNT(*)::int AS n
      FROM "Complaint"
      WHERE ${where} AND "closedAt" >= ${start} AND status IN ('CLOSED', 'HAPPY_CALLING')
      GROUP BY 1
    `,
    prisma.$queryRaw<{ id: string; ticketNo: string; customerName: string; status: string; callType: string; districtName: string | null; bookDate: Date; companyId: string }[]>`
      SELECT "id", "ticketNo", "customerName", status, "callType", "districtName", "bookDate", "companyId"
      FROM "Complaint" WHERE ${where}
      ORDER BY "bookDate" DESC
      LIMIT 6
    `,
    prisma.company.findMany({ select: { id: true, shortName: true, accent: true }, orderBy: { code: "asc" } }),
    prisma.$queryRaw<{ id: string; n: number }[]>`
      SELECT "companyId" AS id, COUNT(*)::int AS n
      FROM "Complaint"
      WHERE ${where} AND status IN (${active})
      GROUP BY "companyId"
    `,
  ]);
  const names = new Map(companyRows.map((company) => [company.id, company.shortName]));
  const loggedMap = new Map(loggedRows.map((row) => [dayKey(row.d), Number(row.n)]));
  const closedMap = new Map(closedRows.map((row) => [dayKey(row.d), Number(row.n)]));
  const ymd = kolkataYmd(now);
  const trend = Array.from({ length: 30 }, (_, index) => {
    const shifted = shiftYmd(ymd.y, ymd.m, ymd.d, -29 + index);
    const key = `${shifted.y}-${String(shifted.m).padStart(2, "0")}-${String(shifted.d).padStart(2, "0")}`;
    return { date: key.slice(5), logged: loggedMap.get(key) ?? 0, closed: closedMap.get(key) ?? 0 };
  });
  const activeByCompany = new Map(companyActive.map((row) => [row.id, Number(row.n)]));
  const gap = async (expr: Prisma.Sql) => prisma.$queryRaw<{ label: string; total: number; missing: number }[]>`
    SELECT ${expr} AS label, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE "serialNorm" IS NULL)::int AS missing
    FROM "Complaint" WHERE ${where}
    GROUP BY 1
    HAVING COUNT(*) FILTER (WHERE "serialNorm" IS NULL) > 0
    ORDER BY missing DESC
    LIMIT 8
  `;
  const [serialTotals, byState, byTechnician, bySource] = await Promise.all([
    prisma.$queryRaw<{ total: number; missing: number }[]>`
      SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE "serialNorm" IS NULL)::int AS missing
      FROM "Complaint" WHERE ${where}
    `,
    gap(Prisma.raw(`COALESCE("stateName", 'Unknown')`)),
    gap(Prisma.raw(`COALESCE("assignedName", 'Unassigned')`)),
    gap(Prisma.raw(`COALESCE(source, 'Unknown')`)),
  ]);
  const shape = (rows: { label: string; total: number; missing: number }[]): SerialGap[] => rows.map((row) => ({
    label: row.label,
    total: Number(row.total),
    missing: Number(row.missing),
    percent: Number(row.total) ? Math.round((Number(row.missing) / Number(row.total)) * 1000) / 10 : 0,
  }));
  const serialTotal = Number(serialTotals[0]?.total ?? 0);
  const serialMissing = Number(serialTotals[0]?.missing ?? 0);
  return {
    tiles,
    drill: {
      dimension: dim,
      rows: drillRows.map((row) => ({
        label: dim === "type" ? labelOf(CALL_TYPES, row.label) : row.label,
        value: Number(row.n),
        href: tileHref(drill, { statusGroup: "active", ...(row.id ? { [paramKey]: row.id } : {}) }),
      })),
    },
    trend,
    recent: recentRows.map((row) => ({
      id: row.id,
      ticketNo: row.ticketNo,
      customerName: row.customerName,
      status: row.status,
      callType: row.callType,
      districtName: row.districtName,
      bookDate: new Date(row.bookDate).toISOString(),
      companyName: names.get(row.companyId) ?? "",
    })),
    companies: companyRows.map((company) => ({
      id: company.id,
      shortName: company.shortName,
      accent: company.accent,
      active: activeByCompany.get(company.id) ?? 0,
    })),
    serialGap: {
      total: serialTotal,
      missing: serialMissing,
      percent: serialTotal ? Math.round((serialMissing / serialTotal) * 1000) / 10 : 0,
      byState: shape(byState),
      byTechnician: shape(byTechnician),
      bySource: shape(bySource),
    },
  };
}

export async function getDashboard(user: SessionUser, scope: string, filters: ComplaintFilters, dimension = "state", now = new Date()) {
  if (process.env.VITEST) return computeDashboard(user, scope, filters, dimension, now);
  const key = JSON.stringify({ user: user.id, scope, filters, dimension, bucket: Math.floor(now.getTime() / 5000) });
  const cached = dashCache.get(key);
  if (cached) return cached;
  const pending = inflight.get(key);
  if (pending) return pending;
  const promise = computeDashboard(user, scope, filters, dimension, now)
    .then((data) => {
      dashCache.set(key, data);
      if (dashCache.size > 80) dashCache.delete(dashCache.keys().next().value!);
      return data;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}
