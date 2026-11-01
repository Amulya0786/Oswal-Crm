import { AppError } from "@/lib/errors";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/constants";
import { can } from "@/lib/rbac";
import type { CurrentUser } from "./current-user";
import { audit } from "./audit";

function assertAdmin(user: CurrentUser) {
  if (!can(user.role, "manageUsers")) throw new AppError("Only an admin can manage users.", 403);
}

const publicSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  employeeCode: true,
  active: true,
  createdAt: true,
  stateAccess: { select: { stateId: true } },
  districtAccess: { select: { districtId: true } },
  brandAccess: { select: { brandId: true } },
} as const;

export async function listUsers() {
  const users = await prisma.user.findMany({ select: publicSelect, orderBy: { name: "asc" } });
  return users.map((user) => ({
    ...user,
    stateIds: user.stateAccess.map((row) => row.stateId),
    districtIds: user.districtAccess.map((row) => row.districtId),
    brandIds: user.brandAccess.map((row) => row.brandId),
  }));
}

export async function createUser(actor: CurrentUser, input: { name?: string; email?: string; phone?: string; employeeCode?: string; role?: string; password?: string }) {
  assertAdmin(actor);
  const name = input.name?.trim() ?? "";
  const email = input.email?.trim().toLowerCase() ?? "";
  const employeeCode = input.employeeCode?.trim() ?? "";
  const role = input.role ?? "";
  const password = input.password ?? "";
  if (!name || !email || !employeeCode) throw new AppError("Name, email and employee code are required.");
  if (!ROLES.some((item) => item.value === role)) throw new AppError("Choose a valid role.");
  if (password.length < 8) throw new AppError("Password must be at least 8 characters.");
  const user = await prisma.user.create({
    data: { name, email, employeeCode, role, phone: input.phone?.trim() || null, passwordHash: hashPassword(password) },
  });
  await audit({ entity: "user", entityId: user.id, action: "create", userId: actor.id, changes: { email, role } });
  return { id: user.id };
}

export async function updateUser(actor: CurrentUser, id: string, input: { name?: string; email?: string; phone?: string; role?: string; active?: boolean; password?: string }) {
  assertAdmin(actor);
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new AppError("User not found.", 404);
  if (existing.id === actor.id && input.active === false) throw new AppError("You cannot deactivate your own login.");
  if (existing.role === "ADMIN" && ((input.role && input.role !== "ADMIN") || input.active === false)) {
    const admins = await prisma.user.count({ where: { role: "ADMIN", active: true, NOT: { id } } });
    if (admins === 0) throw new AppError("Keep at least one active admin.");
  }
  if (input.password && input.password.length < 8) throw new AppError("Password must be at least 8 characters.");
  const role = input.role ?? existing.role;
  if (!ROLES.some((item) => item.value === role)) throw new AppError("Choose a valid role.");
  await prisma.user.update({
    where: { id },
    data: {
      name: input.name?.trim() || existing.name,
      email: input.email?.trim().toLowerCase() || existing.email,
      phone: input.phone === undefined ? existing.phone : input.phone.trim() || null,
      role,
      active: input.active ?? existing.active,
      ...(input.password ? { passwordHash: hashPassword(input.password) } : {}),
    },
  });
  await audit({ entity: "user", entityId: id, action: "update", userId: actor.id, changes: { role, active: input.active } });
}

export async function setPermissions(actor: CurrentUser, id: string, input: { stateIds?: string[]; districtIds?: string[]; brandIds?: string[] }) {
  assertAdmin(actor);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError("User not found.", 404);
  const stateIds = [...new Set(input.stateIds ?? [])];
  const districtIds = [...new Set(input.districtIds ?? [])];
  const brandIds = [...new Set(input.brandIds ?? [])];
  await prisma.$transaction([
    prisma.userStateAccess.deleteMany({ where: { userId: id } }),
    prisma.userDistrictAccess.deleteMany({ where: { userId: id } }),
    prisma.userBrandAccess.deleteMany({ where: { userId: id } }),
    ...(stateIds.length ? [prisma.userStateAccess.createMany({ data: stateIds.map((stateId) => ({ userId: id, stateId })) })] : []),
    ...(districtIds.length ? [prisma.userDistrictAccess.createMany({ data: districtIds.map((districtId) => ({ userId: id, districtId })) })] : []),
    ...(brandIds.length ? [prisma.userBrandAccess.createMany({ data: brandIds.map((brandId) => ({ userId: id, brandId })) })] : []),
  ]);
  await audit({ entity: "user", entityId: id, action: "permissions", userId: actor.id, changes: { stateIds, districtIds, brandIds } });
}
