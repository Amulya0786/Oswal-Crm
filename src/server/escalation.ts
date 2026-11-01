import { ROLES, labelOf, OPEN_WORK_STATUSES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { isCloseBreach, isResponseBreach, nextEscalation, shouldEscalate } from "@/lib/sla";
import { audit } from "./audit";
import { dispatchEscalation } from "./notifications";

async function pickUser(role: string, stateId: string | null, districtId: string | null) {
  const users = await prisma.user.findMany({
    where: { role, active: true },
    include: { stateAccess: true, districtAccess: true },
    orderBy: { name: "asc" },
  });
  if (role === "ADMIN") return users[0] ?? null;
  if (role === "AREA_MANAGER") {
    return (
      users.find((user) => districtId && user.districtAccess.some((row) => row.districtId === districtId)) ??
      users.find((user) => stateId && user.stateAccess.some((row) => row.stateId === stateId)) ??
      null
    );
  }
  if (role === "STATE_HEAD") {
    return users.find((user) => stateId && user.stateAccess.some((row) => row.stateId === stateId)) ?? null;
  }
  return null;
}

export async function runEscalation(actorId: string | null, options?: { force?: boolean; now?: Date }) {
  const now = options?.now ?? new Date();
  const force = options?.force ?? false;
  const policies = await prisma.slaPolicy.findMany();
  const cooldownFor = new Map(policies.map((policy) => [policy.complaintType, policy.escalationCooldownHours]));
  const open = await prisma.complaint.findMany({ where: { status: { in: [...OPEN_WORK_STATUSES] } } });
  let escalated = 0;
  let flagged = 0;

  for (const complaint of open) {
    const responseBreached = isResponseBreach(complaint, now);
    const closeBreached = isCloseBreach(complaint, now);
    if (responseBreached !== complaint.responseBreached || closeBreached !== complaint.closeBreached) {
      await prisma.complaint.update({ where: { id: complaint.id }, data: { responseBreached, closeBreached } });
      flagged++;
    }
    const cooldown = cooldownFor.get(complaint.type) ?? 12;
    if (!shouldEscalate(complaint, now, cooldown, force)) continue;
    const next = nextEscalation(complaint.escalationLevel);
    if (!next) continue;
    const target = await pickUser(next.role, complaint.stateId, complaint.districtId);
    const reason = responseBreached && closeBreached ? "Response and closing SLA breached" : responseBreached ? "Response SLA breached" : "Closing SLA breached";
    await prisma.$transaction([
      prisma.complaint.update({
        where: { id: complaint.id },
        data: {
          escalationLevel: next.level,
          lastEscalatedAt: now,
          escalatedToUserId: target?.id ?? null,
          responseBreached,
          closeBreached,
        },
      }),
      prisma.escalationLog.create({
        data: {
          complaintId: complaint.id,
          fromLevel: complaint.escalationLevel,
          toLevel: next.level,
          toRole: next.role,
          toUserId: target?.id,
          reason,
          createdAt: now,
        },
      }),
      prisma.complaintEvent.create({
        data: {
          complaintId: complaint.id,
          type: "ESCALATED",
          message: target
            ? `Escalated to ${labelOf(ROLES, next.role)} ${target.name}. ${reason}.`
            : `Escalated to ${labelOf(ROLES, next.role)}. No active user in that role covers this area. ${reason}.`,
          userId: actorId,
          createdAt: now,
        },
      }),
    ]);
    if (target) await dispatchEscalation(complaint.id, target);
    escalated++;
  }

  await audit({ entity: "job", action: "escalate", userId: actorId, changes: { escalated, flagged, scanned: open.length, force } });
  return { escalated, flagged, scanned: open.length };
}
