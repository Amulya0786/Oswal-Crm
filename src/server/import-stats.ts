import { prisma } from "./db";
import { homeSnapshot } from "./home";
import type { SessionUser } from "@/lib/types";

/** Counts only. The same headline query the dashboard caches. */
export async function importStats(user: SessionUser) {
  const [dash, byCompanyStatusMonth, openByStatus] = await Promise.all([
    homeSnapshot(user, "all", null),
    prisma.$queryRaw<{ company: string; status: string; month: string; n: number }[]>`
      SELECT co."shortName" AS company, c.status,
        to_char((c."bookDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') AS month,
        COUNT(*)::int AS n
      FROM "Complaint" c
      JOIN "Company" co ON co.id = c."companyId"
      WHERE c."excludeFromMis" = false
      GROUP BY 1, 2, 3
      ORDER BY 3, 1, 2
    `,
    prisma.$queryRaw<{ status: string; n: number }[]>`
      SELECT c.status, COUNT(*)::int AS n
      FROM "Complaint" c
      WHERE c."excludeFromMis" = false
        AND c.status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING')
      GROUP BY 1
      ORDER BY 1
    `,
  ]);
  return {
    byCompanyStatusMonth,
    openByStatus,
    headlines: {
      bookedToday: dash.kpi?.booked ?? 0,
      closedToday: dash.kpi?.closed ?? 0,
      pending: dash.kpi?.pending ?? 0,
      overdue: dash.kpi?.overdue ?? 0,
      firstContactOverdue: dash.kpi?.first_contact ?? 0,
      repeatsOpen: dash.kpi?.repeats ?? 0,
      happyWaiting: dash.kpi?.happy ?? 0,
      unassigned: dash.unassigned ?? 0,
      updatedAt: dash.updatedAt,
    },
  };
}
