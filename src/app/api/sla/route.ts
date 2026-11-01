import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { COMPLAINT_TYPES } from "@/lib/constants";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { readJson, withUser } from "@/server/http";
import { audit } from "@/server/audit";

export const POST = withUser(async (user, request) => {
  if (!can(user.role, "manageSla")) throw new AppError("Only an admin can change SLAs.", 403);
  const body = await readJson<{ policies?: { complaintType: string; responseHours: number; closeHours: number; escalationCooldownHours: number }[] }>(request);
  for (const policy of body.policies ?? []) {
    if (!COMPLAINT_TYPES.some((type) => type.value === policy.complaintType)) throw new AppError("Unknown complaint type.");
    if (policy.responseHours < 1 || policy.closeHours < 1) throw new AppError("SLA hours must be at least 1.");
    await prisma.slaPolicy.upsert({
      where: { complaintType: policy.complaintType },
      update: {
        responseHours: Number(policy.responseHours),
        closeHours: Number(policy.closeHours),
        escalationCooldownHours: Number(policy.escalationCooldownHours) || 12,
      },
      create: {
        complaintType: policy.complaintType,
        responseHours: Number(policy.responseHours),
        closeHours: Number(policy.closeHours),
        escalationCooldownHours: Number(policy.escalationCooldownHours) || 12,
      },
    });
  }
  await audit({ entity: "sla", action: "update", userId: user.id, changes: body.policies });
  return NextResponse.json({ ok: true });
});
