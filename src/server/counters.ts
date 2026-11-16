import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { deskScopeSql } from "./scope";
import { kolkataTodayStart, midnightShift } from "@/lib/time";
import { remember } from "./memory-cache";
import type { SessionUser } from "@/lib/types";

export type CounterRow = {
  id: string;
  label: string;
  b07: number;
  b815: number;
  b1630: number;
  b30: number;
  pendingToday: number;
  closedToday: number;
  happyToday: number;
  totalPending: number;
};

async function loadCounters(user: SessionUser, scope: string, kind: "state" | "brand") {
  const now = new Date();
  const today = kolkataTodayStart(now);
  const tomorrow = midnightShift(now, 1);
  const where = deskScopeSql(user, scope, "c");
  const label = kind === "state" ? Prisma.sql`COALESCE(NULLIF(c."stateName", ''), 'Unknown')` : Prisma.sql`COALESCE(NULLIF(c."brandName", ''), 'No brand')`;
  const id = kind === "state" ? Prisma.sql`COALESCE(c."stateId", '')` : Prisma.sql`COALESCE(c."brandId", '')`;
  const start7 = midnightShift(now, -7);
  const start15 = midnightShift(now, -15);
  const start30 = midnightShift(now, -30);
  return prisma.$queryRaw<CounterRow[]>`
    SELECT ${id} AS id, ${label} AS label,
      COUNT(*) FILTER (WHERE c.status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING') AND c."bookDate" >= ${start7} AND c."bookDate" < ${tomorrow})::int AS b07,
      COUNT(*) FILTER (WHERE c.status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING') AND c."bookDate" >= ${start15} AND c."bookDate" < ${start7})::int AS b815,
      COUNT(*) FILTER (WHERE c.status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING') AND c."bookDate" >= ${start30} AND c."bookDate" < ${start15})::int AS b1630,
      COUNT(*) FILTER (WHERE c.status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING') AND c."bookDate" < ${start30})::int AS b30,
      COUNT(*) FILTER (WHERE c.status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING') AND c."bookDate" >= ${today} AND c."bookDate" < ${tomorrow})::int AS "pendingToday",
      COUNT(*) FILTER (WHERE c.status IN ('CLOSED','CLOSED_UNVERIFIED','HAPPY_CALLING') AND c."closedAt" >= ${today} AND c."closedAt" < ${tomorrow})::int AS "closedToday",
      COUNT(*) FILTER (WHERE c.status = 'HAPPY_CALLING' AND c."happyAt" >= ${today} AND c."happyAt" < ${tomorrow})::int AS "happyToday",
      COUNT(*) FILTER (WHERE c.status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING'))::int AS "totalPending"
    FROM "Complaint" c
    WHERE ${where}
    GROUP BY 1, 2
    ORDER BY "totalPending" DESC
    LIMIT 80
  `;
}

export function ticketCounters(user: SessionUser, scope: string, kind: "state" | "brand") {
  const key = JSON.stringify({ id: user.id, role: user.role, scope, kind, companies: user.companyIds, states: user.stateIds });
  return remember("counters", key, 60_000, () => loadCounters(user, scope, kind));
}
