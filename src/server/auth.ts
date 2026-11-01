import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import type { Capabilities, CompanyBrief, Role, SessionUser } from "@/lib/types";
import { ROLES } from "@/lib/types";
import { HttpError } from "./http";

const ROLE_SET = new Set<string>(ROLES);

export function capabilities(role: Role): Capabilities {
  const can = (roles: Role[]) => roles.includes(role);
  return {
    book: can(["ADMIN", "CALL_CENTRE", "AREA_MANAGER", "STATE_HEAD", "DEALER"]),
    assign: can(["ADMIN", "CALL_CENTRE", "AREA_MANAGER", "STATE_HEAD"]),
    close: can(["ADMIN", "CALL_CENTRE", "AREA_MANAGER", "STATE_HEAD", "TECHNICIAN"]),
    happy: can(["ADMIN", "CALL_CENTRE"]),
    cancel: can(["ADMIN", "CALL_CENTRE", "STATE_HEAD"]),
    hold: can(["ADMIN", "CALL_CENTRE", "AREA_MANAGER", "STATE_HEAD", "TECHNICIAN"]),
    note: can(["ADMIN", "CALL_CENTRE", "AREA_MANAGER", "STATE_HEAD", "TECHNICIAN", "DEALER"]),
    reopen: can(["ADMIN", "CALL_CENTRE", "STATE_HEAD"]),
    masterWrite: can(["ADMIN"]),
    masterView: can(["ADMIN", "CALL_CENTRE", "AREA_MANAGER", "STATE_HEAD"]),
    security: can(["ADMIN"]),
    report: can(["ADMIN", "CALL_CENTRE", "AREA_MANAGER", "STATE_HEAD"]),
    import: can(["ADMIN", "CALL_CENTRE"]),
    settings: can(["ADMIN"]),
    export: can(["ADMIN", "CALL_CENTRE", "AREA_MANAGER", "STATE_HEAD"]),
    analytics: can(["ADMIN", "CALL_CENTRE", "AREA_MANAGER", "STATE_HEAD"]),
    allCompanies: can(["ADMIN"]),
  };
}

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  engineerId: string | null;
  isTest: boolean;
  mustChangePassword: boolean;
  active: boolean;
  memberships: { company: CompanyBrief }[];
  states: { stateId: string }[];
  districts: { districtId: string }[];
  brands: { brandId: string }[];
};

export function toSessionUser(user: UserRow): SessionUser {
  const role = (ROLE_SET.has(user.role) ? user.role : "DEALER") as Role;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role,
    phone: user.phone,
    isTest: user.isTest,
    mustChangePassword: user.mustChangePassword,
    engineerId: user.engineerId,
    companies: user.memberships.map((row) => row.company),
    companyIds: user.memberships.map((row) => row.company.id),
    stateIds: user.states.map((row) => row.stateId),
    districtIds: user.districts.map((row) => row.districtId),
    brandIds: user.brands.map((row) => row.brandId),
    caps: capabilities(role),
  };
}

const userInclude = {
  memberships: { include: { company: true } },
  states: true,
  districts: true,
  brands: true,
} as const;

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get("oswal_session")?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: userInclude } },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  return toSessionUser(session.user);
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/password");
  return user;
}

export function rejectTemporaryPassword(user: { mustChangePassword: boolean }) {
  if (user.mustChangePassword) throw new HttpError(403, "Change your password before using the desk");
}

export const getScope = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return { user: null, scope: "all" };
  const cookie = (await cookies()).get("oswal_company")?.value;
  if (cookie === "all" && user.caps.allCompanies) return { user, scope: "all" };
  if (cookie && user.companyIds.includes(cookie)) return { user, scope: cookie };
  if (user.caps.allCompanies) return { user, scope: "all" };
  return { user, scope: user.companyIds[0] ?? "all" };
});

export async function login(email: string, password: string, meta: { ip?: string; userAgent?: string }) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, include: userInclude });
  const ok = Boolean(user && user.active && (await bcrypt.compare(password, user.passwordHash)));
  await prisma.loginHistory.create({
    data: {
      userId: user?.id,
      email: email.trim().toLowerCase(),
      success: ok,
      ip: meta.ip,
      userAgent: meta.userAgent?.slice(0, 240),
    },
  });
  if (!ok || !user) return null;
  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  await prisma.session.create({
    data: { token, userId: user.id, expiresAt: new Date(Date.now() + 7 * 86400000) },
  });
  return { token, user: toSessionUser(user) };
}

export async function logout(token: string | undefined) {
  if (!token) return;
  await prisma.session.deleteMany({ where: { token } });
}
