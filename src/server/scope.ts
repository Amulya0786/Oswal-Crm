import { Prisma } from "@prisma/client";
import type { ComplaintFilters, SessionUser } from "@/lib/types";
import { ACTIVE_STATUSES } from "@/lib/labels";
import {
  ageingBounds,
  istMidnight,
  kolkataMonthStart,
  kolkataNextMonthStart,
  kolkataTodayStart,
  midnightShift,
} from "@/lib/time";

export const ACTIVE = [...ACTIVE_STATUSES];

export type RiskContext = {
  now: Date;
  loadIds: string[];
  loadCounts: Map<string, number>;
  hist: Record<string, number>;
};

function col(alias: string | undefined, name: string) {
  const safe = name.replace(/[^A-Za-z0-9_]/g, "");
  return Prisma.raw(alias ? `${alias}."${safe}"` : `"${safe}"`);
}

export function scopeSql(user: SessionUser, scope: string, alias?: string) {
  const parts: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (scope !== "all") parts.push(Prisma.sql`${col(alias, "companyId")} = ${scope}`);
  else if (user.role !== "ADMIN") {
    parts.push(user.companyIds.length ? Prisma.sql`${col(alias, "companyId")} IN (${Prisma.join(user.companyIds)})` : Prisma.sql`FALSE`);
  }
  if (user.role === "TECHNICIAN") {
    parts.push(user.engineerId ? Prisma.sql`${col(alias, "engineerId")} = ${user.engineerId}` : Prisma.sql`FALSE`);
  }
  if (user.role === "DEALER") parts.push(Prisma.sql`${col(alias, "createdById")} = ${user.id}`);
  if (user.role === "OEM_PARTNER") {
    parts.push(user.brandIds.length ? Prisma.sql`${col(alias, "brandId")} IN (${Prisma.join(user.brandIds)})` : Prisma.sql`FALSE`);
  }
  if (user.role === "AREA_MANAGER") {
    parts.push(user.districtIds.length ? Prisma.sql`${col(alias, "districtId")} IN (${Prisma.join(user.districtIds)})` : Prisma.sql`FALSE`);
  }
  if (user.role === "STATE_HEAD") {
    parts.push(user.stateIds.length ? Prisma.sql`${col(alias, "stateId")} IN (${Prisma.join(user.stateIds)})` : Prisma.sql`FALSE`);
  }
  if (user.brandIds.length && user.role !== "ADMIN" && user.role !== "CALL_CENTRE" && user.role !== "OEM_PARTNER") {
    parts.push(Prisma.sql`${col(alias, "brandId")} IN (${Prisma.join(user.brandIds)})`);
  }
  parts.push(Prisma.sql`${col(alias, "excludeFromMis")} = false`);
  return Prisma.join(parts, " AND ");
}

export function canSee(
  user: SessionUser,
  scope: string,
  row: {
    companyId: string;
    districtId: string | null;
    stateId: string | null;
    engineerId: string | null;
    createdById: string | null;
    brandId: string | null;
  },
) {
  if (scope !== "all" && row.companyId !== scope) return false;
  if (user.role !== "ADMIN" && !user.companyIds.includes(row.companyId)) return false;
  if (user.role === "TECHNICIAN" && (!user.engineerId || !row.engineerId || row.engineerId !== user.engineerId)) return false;
  if (user.role === "DEALER" && row.createdById !== user.id) return false;
  if (user.role === "OEM_PARTNER" && (!row.brandId || !user.brandIds.includes(row.brandId))) return false;
  if (user.role === "AREA_MANAGER" && (!row.districtId || !user.districtIds.includes(row.districtId))) return false;
  if (user.role === "STATE_HEAD" && (!row.stateId || !user.stateIds.includes(row.stateId))) return false;
  if (user.brandIds.length && user.role !== "ADMIN" && user.role !== "CALL_CENTRE" && user.role !== "OEM_PARTNER") {
    if (!row.brandId || !user.brandIds.includes(row.brandId)) return false;
  }
  return true;
}

function like(value: string) {
  return `%${value.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

function dayStart(value: string | undefined) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (iso) return istMidnight(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value ?? "");
  if (dmy) return istMidnight(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
  return null;
}

export function riskPredicate(ctx: RiskContext, alias?: string) {
  const book = col(alias, "bookDate");
  const due = col(alias, "slaDueAt");
  const status = col(alias, "status");
  const engineer = col(alias, "engineerId");
  const callType = col(alias, "callType");
  const parts: Prisma.Sql[] = [Prisma.sql`(${ctx.now} >= ${book} + (${due} - ${book}) * 0.75)`];
  if (ctx.loadIds.length) {
    parts.push(Prisma.sql`(${engineer} IN (${Prisma.join(ctx.loadIds)}) AND ${ctx.now} >= ${book} + (${due} - ${book}) * 0.5)`);
  }
  for (const [type, hours] of Object.entries(ctx.hist)) {
    if (!Number.isFinite(hours) || hours <= 0) continue;
    const seconds = Math.round(hours * 3600);
    parts.push(
      Prisma.sql`(${callType} = ${type} AND ${ctx.now} >= ${book} + (${due} - ${book}) * 0.3 AND ${ctx.now} >= ${due} - (${seconds} * INTERVAL '1 second'))`,
    );
  }
  return Prisma.sql`(
    ${status} IN (${Prisma.join(ACTIVE)})
    AND ${due} IS NOT NULL
    AND ${due} > ${ctx.now}
    AND (${Prisma.join(parts, " OR ")})
  )`;
}

export function filterSql(filters: ComplaintFilters, ctx: RiskContext, alias?: string) {
  const now = ctx.now;
  const parts: Prisma.Sql[] = [];
  const status = col(alias, "status");
  const book = col(alias, "bookDate");
  const q = filters.q?.trim().slice(0, 80);
  if (q && q.length >= 2) {
    const pattern = like(q);
    const compact = q.replace(/\s/g, "");
    const ticketPattern = /^OPL/i.test(compact) ? `${compact.toUpperCase()}%` : pattern;
    parts.push(Prisma.sql`(
      ${col(alias, "ticketNo")} ILIKE ${ticketPattern} ESCAPE '\\'
      OR ${col(alias, "customerName")} ILIKE ${pattern} ESCAPE '\\'
      OR ${col(alias, "phone")} ILIKE ${pattern} ESCAPE '\\'
      OR COALESCE(${col(alias, "serialNo")}, '') ILIKE ${pattern} ESCAPE '\\'
      OR COALESCE(${col(alias, "saralId")}, '') ILIKE ${pattern} ESCAPE '\\'
      OR COALESCE(${col(alias, "assignedName")}, '') ILIKE ${pattern} ESCAPE '\\'
      OR COALESCE(${col(alias, "productDetails")}, '') ILIKE ${pattern} ESCAPE '\\'
    )`);
  }
  const knownStatus = new Set<string>([...ACTIVE, "CLOSED", "CLOSED_UNVERIFIED", "HAPPY_CALLING", "CANCELLED"]);
  if (filters.status && knownStatus.has(filters.status)) {
    parts.push(Prisma.sql`${status} = ${filters.status}`);
  } else if (filters.statusGroup === "active") {
    parts.push(Prisma.sql`${status} IN (${Prisma.join(ACTIVE)})`);
  }
  if (filters.callType) parts.push(Prisma.sql`${col(alias, "callType")} = ${filters.callType}`);
  if (filters.stateId) parts.push(Prisma.sql`${col(alias, "stateId")} = ${filters.stateId}`);
  if (filters.districtId) parts.push(Prisma.sql`${col(alias, "districtId")} = ${filters.districtId}`);
  if (filters.engineerId) parts.push(Prisma.sql`${col(alias, "engineerId")} = ${filters.engineerId}`);
  if (filters.productId) parts.push(Prisma.sql`${col(alias, "productId")} = ${filters.productId}`);
  if (filters.brandId) parts.push(Prisma.sql`${col(alias, "brandId")} = ${filters.brandId}`);
  if (filters.priority) parts.push(Prisma.sql`${col(alias, "priority")} = ${filters.priority}`);
  if (filters.source) parts.push(Prisma.sql`${col(alias, "source")} = ${filters.source}`);
  if (filters.companyId) parts.push(Prisma.sql`${col(alias, "companyId")} = ${filters.companyId}`);
  if (filters.scheme === "any") {
    parts.push(Prisma.sql`(${col(alias, "callType")} = 'SCHEME' OR ${col(alias, "schemeName")} IS NOT NULL)`);
  } else if (filters.scheme) {
    parts.push(Prisma.sql`${col(alias, "schemeName")} ILIKE ${like(filters.scheme)} ESCAPE '\\'`);
  }
  const from = dayStart(filters.from);
  const to = dayStart(filters.to);
  if (from) parts.push(Prisma.sql`${book} >= ${from}`);
  if (to) parts.push(Prisma.sql`${book} < ${midnightShift(to, 1)}`);
  if (filters.booked === "today") parts.push(Prisma.sql`${book} >= ${kolkataTodayStart(now)} AND ${book} < ${midnightShift(now, 1)}`);
  if (filters.booked === "month") parts.push(Prisma.sql`${book} >= ${kolkataMonthStart(now)} AND ${book} < ${kolkataNextMonthStart(now)}`);
  if (filters.closed === "today" || filters.closed === "month") {
    const start = filters.closed === "today" ? kolkataTodayStart(now) : kolkataMonthStart(now);
    const end = filters.closed === "today" ? midnightShift(now, 1) : kolkataNextMonthStart(now);
    parts.push(Prisma.sql`${status} IN ('CLOSED','CLOSED_UNVERIFIED','HAPPY_CALLING') AND ((${col(alias, "closedAt")} >= ${start} AND ${col(alias, "closedAt")} < ${end}) OR (${status} = 'HAPPY_CALLING' AND ${col(alias, "happyAt")} >= ${start} AND ${col(alias, "happyAt")} < ${end}))`);
  }
  if (filters.happy === "today" || filters.happy === "month") {
    const start = filters.happy === "today" ? kolkataTodayStart(now) : kolkataMonthStart(now);
    const end = filters.happy === "today" ? midnightShift(now, 1) : kolkataNextMonthStart(now);
    parts.push(Prisma.sql`${status} = 'HAPPY_CALLING' AND ${col(alias, "happyAt")} >= ${start} AND ${col(alias, "happyAt")} < ${end}`);
  }
  if (filters.cancelled === "today" || filters.cancelled === "month") {
    const start = filters.cancelled === "today" ? kolkataTodayStart(now) : kolkataMonthStart(now);
    const end = filters.cancelled === "today" ? midnightShift(now, 1) : kolkataNextMonthStart(now);
    parts.push(Prisma.sql`${status} = 'CANCELLED' AND ${col(alias, "cancelledAt")} >= ${start} AND ${col(alias, "cancelledAt")} < ${end}`);
  }
  if (filters.ageing) {
    const bounds = ageingBounds(filters.ageing, now);
    if (bounds?.gte) parts.push(Prisma.sql`${book} >= ${bounds.gte}`);
    if (bounds?.lt) parts.push(Prisma.sql`${book} < ${bounds.lt}`);
    if (!filters.status) parts.push(Prisma.sql`${status} IN (${Prisma.join(ACTIVE)})`);
  }
  if (filters.breach === "1") {
    parts.push(Prisma.sql`${status} IN (${Prisma.join(ACTIVE)}) AND ${col(alias, "slaDueAt")} IS NOT NULL AND ${col(alias, "slaDueAt")} <= ${now}`);
  }
  if (filters.risk === "1") parts.push(riskPredicate(ctx, alias));
  if (filters.repeat === "1") parts.push(Prisma.sql`${col(alias, "repeatFlag")} = true`);
  if (filters.serialPending === "1") parts.push(Prisma.sql`${col(alias, "serialNorm")} IS NULL`);
  if (filters.channel) parts.push(Prisma.sql`${col(alias, "channel")} = ${filters.channel}`);
  if (filters.includeTest === "1") {
    /* scopeSql already excludes test rows; this flag is handled by the caller */
  }
  return parts.length ? Prisma.join(parts, " AND ") : Prisma.sql`TRUE`;
}

export function filtersFromRecord(input: Record<string, string | string[] | undefined>): ComplaintFilters {
  const one = (key: string) => {
    const value = input[key];
    const raw = Array.isArray(value) ? value[0] : value;
    return raw?.trim() ? raw.trim() : undefined;
  };
  const num = (key: string) => {
    const value = Number(one(key));
    return Number.isFinite(value) && value > 0 ? value : undefined;
  };
  return {
    q: one("q"),
    status: one("status"),
    statusGroup: one("statusGroup"),
    callType: one("callType"),
    stateId: one("stateId"),
    districtId: one("districtId"),
    engineerId: one("engineerId"),
    productId: one("productId"),
    brandId: one("brandId"),
    priority: one("priority"),
    source: one("source"),
    companyId: one("companyId"),
    scheme: one("scheme"),
    from: one("from"),
    to: one("to"),
    booked: one("booked"),
    closed: one("closed"),
    happy: one("happy"),
    cancelled: one("cancelled"),
    ageing: one("ageing"),
    breach: one("breach"),
    risk: one("risk"),
    repeat: one("repeat"),
    serialPending: one("serialPending"),
    asOf: one("asOf"),
    channel: one("channel"),
    includeTest: one("includeTest"),
    sort: one("sort"),
    dir: one("dir"),
    page: num("page"),
    pageSize: num("pageSize"),
  };
}
