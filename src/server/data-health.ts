import { prisma } from "./db";

const OPEN = ["OPEN", "ASSIGNED", "REASSIGNED", "PENDING"];
const MARKS = "?".repeat(3);

export async function dataHealth() {
  const dupNames = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
    `SELECT COUNT(*)::int AS n FROM (SELECT lower("name"), "stateId" FROM "District" WHERE active = true GROUP BY 1, 2 HAVING COUNT(*) > 1) s`,
  );
  const [missingDistrict, junkNames, questionNames, testUsers, testTickets, inactiveDistricts, proposals] = await Promise.all([
    prisma.complaint.count({ where: { districtId: null, excludeFromMis: false, status: { in: OPEN } } }),
    prisma.complaint.count({ where: { excludeFromMis: false, customerName: { in: ["ABC", "Test", "TEST", "asdf"] } } }),
    prisma.complaint.count({ where: { customerName: { contains: MARKS } } }),
    prisma.user.count({ where: { OR: [{ email: { endsWith: "@oswal-test.invalid" } }, { isTest: true }] } }),
    prisma.complaint.count({ where: { OR: [{ qaFlag: true }, { customerName: { startsWith: "QA TEST" } }, { excludeFromMis: true }] } }),
    prisma.district.count({ where: { active: false } }),
    prisma.placeAlias.findMany({ include: { district: { select: { name: true } } }, take: 200, orderBy: { alias: "asc" } }),
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
  };
}

export async function purgeQa(apply: boolean) {
  const users = await prisma.user.findMany({
    where: { OR: [{ email: { endsWith: "@oswal-test.invalid" } }, { isTest: true }] },
    select: { id: true, email: true },
  });
  const ids = users.map((user) => user.id);
  const where = {
    OR: [
      { qaFlag: true },
      { customerName: { startsWith: "QA TEST" } },
      ...(ids.length ? [{ createdById: { in: ids } }] : []),
    ],
  };
  const tickets = await prisma.complaint.count({ where });
  if (apply) {
    await prisma.complaint.updateMany({ where, data: { excludeFromMis: true, qaFlag: true, status: "CANCELLED", finalStatus: "Cancelled", cancelReason: "QA data removed from live counts" } });
    if (ids.length) await prisma.user.updateMany({ where: { id: { in: ids } }, data: { active: false } });
  }
  return { dryRun: !apply, users: users.length, tickets };
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
