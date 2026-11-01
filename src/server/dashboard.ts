import { ageingBucket } from "@/lib/time";
import { countBy, summarize, trend14 } from "@/lib/summary";
import { isOpenWork } from "@/lib/workflow";
import { canSeeComplaint } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "./current-user";
import { andWhere, complaintWhere } from "./scope";
import type { ComplaintFilters } from "./complaints";
import { filtersToWhere } from "./complaints";

export async function loadDashboard(user: CurrentUser, filters: ComplaintFilters) {
  const where = andWhere([
    complaintWhere(user),
    filtersToWhere({
      stateId: filters.stateId,
      districtId: filters.districtId,
      type: filters.type,
      technicianId: filters.technicianId,
      productId: filters.productId,
      brandId: filters.brandId,
    }),
  ]);
  const rows = await prisma.complaint.findMany({
    where,
    select: {
      id: true,
      status: true,
      type: true,
      createdAt: true,
      closedAt: true,
      happyAt: true,
      cancelledAt: true,
      firstResponseAt: true,
      slaResponseDue: true,
      slaCloseDue: true,
      districtId: true,
      stateId: true,
      ticketNumber: true,
    },
  });
  const now = new Date();
  const cards = summarize(rows, now);
  const open = rows.filter((row) => isOpenWork(row.status));
  const districtIds = [...new Set(open.map((row) => row.districtId).filter(Boolean))] as string[];
  const districts = districtIds.length
    ? await prisma.district.findMany({ where: { id: { in: districtIds } }, select: { id: true, name: true, state: { select: { name: true } } } })
    : [];
  const districtName = new Map(districts.map((district) => [district.id, `${district.name}, ${district.state.name}`]));
  const districtCounts = new Map<string, number>();
  for (const row of open) {
    if (!row.districtId) continue;
    districtCounts.set(row.districtId, (districtCounts.get(row.districtId) ?? 0) + 1);
  }
  const byDistrict = [...districtCounts.entries()]
    .map(([id, value]) => ({ id, name: districtName.get(id) ?? "Unknown", value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    .slice(0, 8);

  const [notifications, escalations] = await Promise.all([
    prisma.notificationLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { complaint: { select: { ticketNumber: true, stateId: true, districtId: true, brandId: true, assignedToUserId: true } } },
    }),
    prisma.escalationLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        complaint: { select: { ticketNumber: true, id: true, stateId: true, districtId: true, brandId: true, assignedToUserId: true } },
        toUser: { select: { name: true } },
      },
    }),
  ]);

  return {
    cards,
    byStatus: countBy(rows, (row) => row.status),
    byType: countBy(open, (row) => row.type),
    ageing: (["0-2", "3-7", "8-15", "15+"] as const).map((bucket) => ({
      name: bucket,
      value: open.filter((row) => ageingBucket(row.createdAt, now) === bucket).length,
    })),
    byDistrict,
    trend: trend14(rows, now),
    notifications: notifications
      .filter((row) => (row.complaint ? canSeeComplaint(user, row.complaint) : user.role === "ADMIN"))
      .slice(0, 6),
    escalations: escalations.filter((row) => canSeeComplaint(user, row.complaint)).slice(0, 6),
  };
}
