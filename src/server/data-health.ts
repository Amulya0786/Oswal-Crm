import { prisma } from "./db";

const OPEN = ["OPEN", "ASSIGNED", "REASSIGNED", "PENDING"];
const MARKS = "?".repeat(3);

export async function dataHealth() {
  const dupNames = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
    `SELECT COUNT(*)::int AS n FROM (SELECT lower("name"), "stateId" FROM "District" WHERE active = true GROUP BY 1, 2 HAVING COUNT(*) > 1) s`,
  );
  const [missingDistrict, junkNames, questionNames, testUsers, testTickets, inactiveDistricts, proposals, pins, linkedBlock, urban, approximate, uncovered] = await Promise.all([
    prisma.complaint.count({ where: { districtId: null, excludeFromMis: false, status: { in: OPEN } } }),
    prisma.complaint.count({ where: { excludeFromMis: false, customerName: { in: ["ABC", "Test", "TEST", "asdf"] } } }),
    prisma.complaint.count({ where: { customerName: { contains: MARKS } } }),
    prisma.user.count({ where: { OR: [{ email: { endsWith: "@oswal-test.invalid" } }, { isTest: true }] } }),
    prisma.complaint.count({ where: { OR: [{ qaFlag: true }, { customerName: { startsWith: "QA TEST" } }, { excludeFromMis: true }] } }),
    prisma.district.count({ where: { active: false } }),
    prisma.placeAlias.findMany({ include: { district: { select: { name: true } } }, take: 200, orderBy: { alias: "asc" } }),
    prisma.pincode.count(),
    prisma.pincode.count({ where: { blockId: { not: null }, blockApproximate: false, urban: false } }),
    prisma.pincode.count({ where: { urban: true } }),
    prisma.pincode.count({ where: { blockApproximate: true } }),
    prisma.pincode.count({ where: { blockId: null } }),
  ]);
  return {
    duplicateDistrictNames: Number(dupNames[0]?.n ?? 0),
    missingDistrict,
    junkNames,
    questionNames,
    testUsers,
    testTickets,
    inactiveDistricts,
    mergeList: proposals.map((row) => ({ alias: row.alias, state: row.stateName, into: row.district.name })),
    pincodes: { total: pins, linkedBlock, urban, approximate, none: uncovered },
  };
}

const PURGE_KEY = "lastPurge";

async function purgeWhere() {
  const users = await prisma.user.findMany({
    where: { OR: [{ email: { endsWith: "@oswal-test.invalid" } }, { isTest: true }] },
    select: { id: true },
  });
  const ids = users.map((user) => user.id);
  return {
    ids,
    where: {
      OR: [
        { qaFlag: true },
        { customer: { isTest: true } },
        ...(ids.length ? [{ createdById: { in: ids } }] : []),
      ],
    },
  };
}

export async function purgeQa(apply: boolean) {
  const { ids, where } = await purgeWhere();
  const rows = await prisma.complaint.findMany({
    where,
    select: { id: true, ticketNo: true, status: true, finalStatus: true, closedAt: true, excludeFromMis: true, qaFlag: true, cancelReason: true },
    orderBy: { ticketNo: "asc" },
    take: 500,
  });
  const tickets = await prisma.complaint.count({ where });
  const customers = await prisma.customer.count({ where: { isTest: true } });
  if (apply && tickets) {
    await prisma.appSetting.upsert({
      where: { key: PURGE_KEY },
      create: { key: PURGE_KEY, value: JSON.stringify({ at: new Date().toISOString(), rows }) },
      update: { value: JSON.stringify({ at: new Date().toISOString(), rows }) },
    });
    await prisma.complaint.updateMany({ where, data: { excludeFromMis: true, qaFlag: true, status: "CANCELLED", finalStatus: "Cancelled", cancelReason: "QA data removed from live counts" } });
    if (ids.length) await prisma.user.updateMany({ where: { id: { in: ids } }, data: { active: false, isTest: true } });
  }
  return { dryRun: !apply, users: ids.length, tickets, customers, list: rows.map((row) => row.ticketNo) };
}

export async function undoLastPurge() {
  const saved = await prisma.appSetting.findUnique({ where: { key: PURGE_KEY } });
  if (!saved) return { restored: 0 };
  const parsed = JSON.parse(saved.value) as { rows: { id: string; status: string; finalStatus: string | null; closedAt: string | null; excludeFromMis: boolean; qaFlag: boolean; cancelReason: string | null }[] };
  let restored = 0;
  for (const row of parsed.rows ?? []) {
    await prisma.complaint.update({
      where: { id: row.id },
      data: {
        status: row.status,
        finalStatus: row.finalStatus,
        closedAt: row.closedAt ? new Date(row.closedAt) : null,
        excludeFromMis: row.excludeFromMis,
        qaFlag: row.qaFlag,
        cancelReason: row.cancelReason,
      },
    });
    restored += 1;
  }
  await prisma.appSetting.delete({ where: { key: PURGE_KEY } });
  return { restored };
}

export async function repairName(ticketNo: string, customerName: string) {
  const row = await prisma.complaint.update({
    where: { ticketNo },
    data: { customerName },
    select: { id: true, ticketNo: true, customerName: true, customerId: true },
  });
  if (row.customerId) await prisma.customer.update({ where: { id: row.customerId }, data: { name: customerName } });
  return row;
}
