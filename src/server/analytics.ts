import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { scopeSql } from "./scope";
import type { SessionUser } from "@/lib/types";
import { midnightShift } from "@/lib/time";
import { labelOf, CALL_TYPES } from "@/lib/labels";

export async function getAnalytics(user: SessionUser, scope: string, now = new Date()) {
  const where = scopeSql(user, scope, "c");
  const start = midnightShift(now, -29);
  const [trend, leaders, mttrProduct, mttrState, problems, heat] = await Promise.all([
    fallbackTrend(where, start),
    prisma.$queryRaw<{ name: string; closed: number; live: number; mttr: number | null }[]>`
      SELECT e.name,
        COUNT(*) FILTER (WHERE c.status IN ('CLOSED','HAPPY_CALLING'))::int AS closed,
        COUNT(*) FILTER (WHERE c.status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING'))::int AS live,
        ROUND((AVG(EXTRACT(EPOCH FROM (c."closedAt" - c."bookDate")) / 3600) FILTER (WHERE c."closedAt" IS NOT NULL))::numeric, 1) AS mttr
      FROM "Complaint" c JOIN "Engineer" e ON e.id = c."engineerId"
      WHERE ${where}
      GROUP BY e.id, e.name
      ORDER BY closed DESC
      LIMIT 12
    `,
    prisma.$queryRaw<{ label: string; mttr: number | null; tickets: number }[]>`
      SELECT COALESCE(c."productDetails", 'Unspecified') AS label,
        ROUND((AVG(EXTRACT(EPOCH FROM (c."closedAt" - c."bookDate")) / 3600) FILTER (WHERE c."closedAt" IS NOT NULL))::numeric, 1) AS mttr,
        COUNT(*)::int AS tickets
      FROM "Complaint" c WHERE ${where}
      GROUP BY 1
      HAVING COUNT(*) FILTER (WHERE c."closedAt" IS NOT NULL) > 0
      ORDER BY mttr DESC NULLS LAST
      LIMIT 10
    `,
    prisma.$queryRaw<{ label: string; mttr: number | null; tickets: number }[]>`
      SELECT COALESCE(c."stateName", 'Unknown') AS label,
        ROUND((AVG(EXTRACT(EPOCH FROM (c."closedAt" - c."bookDate")) / 3600) FILTER (WHERE c."closedAt" IS NOT NULL))::numeric, 1) AS mttr,
        COUNT(*)::int AS tickets
      FROM "Complaint" c WHERE ${where} AND c."closedAt" IS NOT NULL
      GROUP BY 1
      ORDER BY mttr DESC NULLS LAST
      LIMIT 10
    `,
    prisma.$queryRaw<{ label: string; tickets: number }[]>`
      SELECT COALESCE(c."actualProblem", c."natureText", 'Not recorded') AS label, COUNT(*)::int AS tickets
      FROM "Complaint" c
      WHERE ${where} AND c.status IN ('CLOSED','HAPPY_CALLING')
      GROUP BY 1
      ORDER BY tickets DESC
      LIMIT 8
    `,
    prisma.$queryRaw<{ label: string; tickets: number }[]>`
      SELECT COALESCE(c."districtName", 'Unknown') AS label, COUNT(*)::int AS tickets
      FROM "Complaint" c
      WHERE ${where} AND c.status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING')
      GROUP BY 1
      ORDER BY tickets DESC
      LIMIT 24
    `,
  ]);
  return {
    trend: trend.map((row) => ({
      date: (row.d instanceof Date ? row.d.toISOString() : String(row.d)).slice(5, 10),
      logged: Number(row.logged ?? 0),
      closed: Number(row.closed ?? 0),
    })),
    leaders: leaders.map((row) => ({ name: row.name, closed: Number(row.closed), live: Number(row.live), mttr: row.mttr == null ? null : Number(row.mttr) })),
    mttrProduct: mttrProduct.map((row) => ({ label: row.label, mttr: Number(row.mttr ?? 0), tickets: Number(row.tickets) })),
    mttrState: mttrState.map((row) => ({ label: row.label, mttr: Number(row.mttr ?? 0), tickets: Number(row.tickets) })),
    problems: problems.map((row) => ({ label: row.label, tickets: Number(row.tickets) })),
    heat: heat.map((row) => ({ label: row.label, tickets: Number(row.tickets) })),
    callTypes: CALL_TYPES.map((item) => item.label),
    note: labelOf(CALL_TYPES, "SCHEME"),
  };
}

async function fallbackTrend(where: Prisma.Sql, start: Date) {
  const logged = await prisma.$queryRaw<{ d: Date | string; n: number }[]>`
    SELECT (("bookDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date AS d, COUNT(*)::int AS n
    FROM "Complaint" c WHERE ${where} AND c."bookDate" >= ${start}
    GROUP BY 1 ORDER BY 1
  `;
  const closed = await prisma.$queryRaw<{ d: Date | string; n: number }[]>`
    SELECT ((c."closedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date AS d, COUNT(*)::int AS n
    FROM "Complaint" c WHERE ${where} AND c."closedAt" >= ${start} AND c.status IN ('CLOSED','HAPPY_CALLING')
    GROUP BY 1
  `;
  const closedMap = new Map(closed.map((row) => [String(row.d).slice(0, 10), Number(row.n)]));
  return logged.map((row) => ({ d: row.d, logged: Number(row.n), closed: closedMap.get(String(row.d).slice(0, 10)) ?? 0 }));
}
