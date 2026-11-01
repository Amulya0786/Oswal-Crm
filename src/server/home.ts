import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { scopeSql } from "./scope";
import { kolkataTodayStart, midnightShift } from "@/lib/time";
import type { SessionUser } from "@/lib/types";

const DASH_TTL_MS = 5 * 60 * 1000;

function cacheKey(user: SessionUser, scope: string, stateName?: string | null) {
  return `dash:${user.role}:${scope}:${stateName ?? ""}:${user.companyIds.join(".")}:${user.stateIds.join(".")}:${user.brandIds.join(".")}`;
}

export async function homeSnapshot(user: SessionUser, scope: string, stateName?: string | null) {
  const key = cacheKey(user, scope, stateName);
  const cached = await prisma.appSetting.findUnique({ where: { key } });
  if (cached) {
    try {
      const parsed = JSON.parse(cached.value) as { at: string; data: Awaited<ReturnType<typeof computeHome>> };
      if (Date.now() - new Date(parsed.at).getTime() < DASH_TTL_MS) return { ...parsed.data, updatedAt: parsed.at };
    } catch { /* recompute */ }
  }
  const data = await computeHome(user, scope, stateName);
  const at = new Date().toISOString();
  await prisma.appSetting.upsert({ where: { key }, create: { key, value: JSON.stringify({ at, data }) }, update: { value: JSON.stringify({ at, data }) } });
  return { ...data, updatedAt: at };
}

export async function warmDashboardCache() {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", active: true },
    include: { memberships: { include: { company: true } }, states: true, districts: true, brands: true },
  });
  if (!admin) return { warmed: false };
  const { toSessionUser } = await import("./auth");
  await homeSnapshot(toSessionUser(admin), "all", null);
  return { warmed: true, at: new Date().toISOString() };
}

async function computeHome(user: SessionUser, scope: string, stateName?: string | null) {
  const where = scopeSql(user, scope, "c");
  const extra = stateName ? Prisma.sql`AND c."stateName" = ${stateName}` : Prisma.empty;
  const now = new Date();
  const today = kolkataTodayStart(now);
  const tomorrow = midnightShift(now, 1);
  const monthAgo = new Date(now.getTime() - 30 * 86400000);
  const place = stateName ? Prisma.sql`c."districtName"` : Prisma.sql`c."stateName"`;
  const [kpi] = await prisma.$queryRaw<{ booked: number; closed: number; pending: number; overdue: number; repeats: number; happy: number; rating: number; first_contact: number }[]>`
    SELECT
      COUNT(*) FILTER (WHERE c."bookDate" >= ${today} AND c."bookDate" < ${tomorrow})::int AS booked,
      COUNT(*) FILTER (WHERE c.status IN ('CLOSED','CLOSED_UNVERIFIED','HAPPY_CALLING') AND (
        (c."closedAt" >= ${today} AND c."closedAt" < ${tomorrow})
        OR (c.status = 'HAPPY_CALLING' AND c."happyAt" >= ${today} AND c."happyAt" < ${tomorrow})
      ))::int AS closed,
      COUNT(*) FILTER (WHERE c.status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING'))::int AS pending,
      COUNT(*) FILTER (WHERE c.status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING') AND COALESCE(c."callbackDueAt", c."slaDueAt") IS NOT NULL AND COALESCE(c."callbackDueAt", c."slaDueAt") <= ${now})::int AS overdue,
      COUNT(*) FILTER (WHERE c."repeatFlag" = true AND c.status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING'))::int AS repeats,
      COUNT(*) FILTER (WHERE c.status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING') AND c."callbackDueAt" IS NOT NULL AND c."callbackDueAt" <= ${now} AND c."assignedAt" IS NULL)::int AS first_contact,
      COUNT(*) FILTER (WHERE c."feedbackPending" = true)::int AS happy,
      COALESCE(ROUND(AVG(c."happyRating") FILTER (WHERE c."happyRating" IS NOT NULL))::int, 0) AS rating
    FROM "Complaint" c
    WHERE ${where} ${extra}
  `;
  const ageing = await prisma.$queryRaw<{ label: string; n: number }[]>`
    SELECT bucket AS label, COUNT(*)::int AS n FROM (
      SELECT CASE
        WHEN EXTRACT(EPOCH FROM (${now} - c."bookDate")) / 86400 < 3 THEN '0-2 days'
        WHEN EXTRACT(EPOCH FROM (${now} - c."bookDate")) / 86400 < 8 THEN '3-7 days'
        WHEN EXTRACT(EPOCH FROM (${now} - c."bookDate")) / 86400 < 16 THEN '8-15 days'
        WHEN EXTRACT(EPOCH FROM (${now} - c."bookDate")) / 86400 < 31 THEN '16-30 days'
        ELSE 'Over 30 days'
      END AS bucket
      FROM "Complaint" c
      WHERE ${where} ${extra}
        AND c.status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING')
    ) s GROUP BY 1
  `;
  const places = await prisma.$queryRaw<{ label: string; open: number; overdue: number }[]>`
    SELECT COALESCE(NULLIF(${place}, ''), 'Unknown') AS label,
      COUNT(*) FILTER (WHERE c.status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING'))::int AS open,
      COUNT(*) FILTER (WHERE c.status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING') AND c."slaDueAt" IS NOT NULL AND c."slaDueAt" <= ${now})::int AS overdue
    FROM "Complaint" c
    WHERE ${where} ${extra}
    GROUP BY 1
    ORDER BY open DESC
    LIMIT 20
  `;
  const technicians = await prisma.$queryRaw<{ label: string; n: number }[]>`
    SELECT COALESCE(c."assignedName", 'Unassigned') AS label, COUNT(*)::int AS n
    FROM "Complaint" c
    WHERE ${where} ${extra}
      AND c.status IN ('CLOSED','HAPPY_CALLING')
      AND c."closedAt" >= ${monthAgo}
    GROUP BY 1
    ORDER BY n DESC
    LIMIT 8
  `;
  const companies = await prisma.$queryRaw<{ label: string; n: number }[]>`
    SELECT co."shortName" AS label, COUNT(*)::int AS n
    FROM "Complaint" c JOIN "Company" co ON co.id = c."companyId"
    WHERE ${where} ${extra}
      AND c.status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING')
    GROUP BY 1
    ORDER BY n DESC
  `;
  const trend = await prisma.$queryRaw<{ day: Date; booked: number }[]>`
    SELECT ((c."bookDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date AS day,
      COUNT(*)::int AS booked
    FROM "Complaint" c
    WHERE ${where} ${extra} AND c."bookDate" >= ${monthAgo}
    GROUP BY 1
    ORDER BY 1
  `;
  const followUps = await prisma.$queryRaw<{ id: string; ticketNo: string; customerName: string; districtName: string | null }[]>`
    SELECT c.id, c."ticketNo", c."customerName", c."districtName"
    FROM "Complaint" c
    WHERE ${where} ${extra} AND c.status = 'PENDING'
    ORDER BY c."bookDate" DESC
    LIMIT 8
  `;
  const happyQueue = await prisma.$queryRaw<{ id: string; ticketNo: string; customerName: string; assignedName: string | null }[]>`
    SELECT c.id, c."ticketNo", c."customerName", c."assignedName"
    FROM "Complaint" c
    WHERE ${where} ${extra} AND c."feedbackPending" = true
    ORDER BY c."closedAt" DESC NULLS LAST
    LIMIT 8
  `;
  const todayBooked = await prisma.$queryRaw<{ id: string; ticketNo: string; customerName: string; districtName: string | null }[]>`
    SELECT c.id, c."ticketNo", c."customerName", c."districtName"
    FROM "Complaint" c
    WHERE ${where} ${extra} AND c."bookDate" >= ${today} AND c."bookDate" < ${tomorrow}
    ORDER BY c."bookDate" DESC
    LIMIT 8
  `;
  const filled = [];
  for (let offset = 29; offset >= 0; offset -= 1) {
    const day = new Date(now.getTime() - offset * 86400000);
    const key = day.toISOString().slice(0, 10);
    const found = trend.find((row) => new Date(row.day).toISOString().slice(0, 10) === key);
    filled.push({ day: key, booked: found?.booked ?? 0 });
  }
  const byCall = await prisma.$queryRaw<{ label: string; n: number }[]>`
    SELECT c."callType" AS label, COUNT(*)::int AS n FROM "Complaint" c
    WHERE ${where} ${extra} AND c.status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING')
    GROUP BY 1 ORDER BY 2 DESC
  `;
  const byStatus = await prisma.$queryRaw<{ label: string; n: number }[]>`
    SELECT c.status AS label, COUNT(*)::int AS n FROM "Complaint" c
    WHERE ${where} ${extra} GROUP BY 1 ORDER BY 2 DESC
  `;
  const monthBooked = await prisma.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM "Complaint" c
    WHERE ${where} ${extra} AND c."bookDate" >= ${monthAgo}
  `;
  const latest = await prisma.$queryRaw<{ id: string; ticketNo: string; customerName: string; status: string; stateName: string | null }[]>`
    SELECT c.id, c."ticketNo", c."customerName", c.status, c."stateName"
    FROM "Complaint" c
    WHERE ${where} ${extra} AND c.status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING')
    ORDER BY c."bookDate" DESC LIMIT 8
  `;
  const amc = await prisma.serviceContract.count({ where: { status: "ACTIVE", end: { lte: new Date(now.getTime() + 30 * 86400000) } } });
  const unassigned = await prisma.complaint.count({ where: { status: "OPEN", engineerId: null, excludeFromMis: false } });
  return {
    kpi: kpi ?? { booked: 0, closed: 0, pending: 0, overdue: 0, repeats: 0, happy: 0, rating: 0, first_contact: 0 },
    byCall,
    byStatus,
    monthBooked: Number(monthBooked[0]?.n ?? 0),
    latest,
    amc,
    unassigned,
    ageing,
    places,
    technicians,
    companies,
    trend: filled,
    followUps,
    happyQueue,
    todayBooked,
  };
}
