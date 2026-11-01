import { Prisma } from "@prisma/client";
import type { AccessUser } from "@/lib/permissions";

export function complaintWhere(user: AccessUser): Prisma.ComplaintWhereInput {
  if (user.role === "ADMIN") return {};
  if (user.role === "TECHNICIAN") return { assignedToUserId: user.id };
  return {
    stateId: { in: user.stateIds.length ? user.stateIds : ["__none__"] },
    ...(user.districtIds.length ? { districtId: { in: user.districtIds } } : {}),
    ...(user.brandIds.length ? { brandId: { in: user.brandIds } } : {}),
  };
}

export function andWhere(parts: Prisma.ComplaintWhereInput[]): Prisma.ComplaintWhereInput {
  const cleaned = parts.filter((part) => Object.keys(part).length > 0);
  if (cleaned.length === 0) return {};
  if (cleaned.length === 1) return cleaned[0];
  return { AND: cleaned };
}
