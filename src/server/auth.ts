import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "./db";
import type { Capabilities, CompanyBrief, Role, SessionUser } from "@/lib/types";
import { ROLES } from "@/lib/types";
import { HttpError } from "./http";

const ROLE_SET = new Set<string>(ROLES);

export function capabilities(role: Role): Capabilities {
  const can = (roles: Role[]) => roles.includes(role);
  return {
    book: can(["ADMIN", "CALL_CENTRE", "CALL_CLOSER", "AREA_MANAGER", "STATE_HEAD", "DEALER", "OEM_PARTNER"]),
    assign: can(["ADMIN", "AREA_MANAGER", "STATE_HEAD"]),
    close: can(["ADMIN", "CALL_CLOSER", "AREA_MANAGER", "STATE_HEAD", "TECHNICIAN"]),
    happy: can(["ADMIN", "CALL_CENTRE", "CALL_CLOSER"]),
    cancel: can(["ADMIN", "STATE_HEAD"]),
    hold: can(["ADMIN", "AREA_MANAGER", "STATE_HEAD", "TECHNICIAN"]),
    note: can(["ADMIN", "CALL_CENTRE", "CALL_CLOSER", "AREA_MANAGER", "STATE_HEAD", "TECHNICIAN", "DEALER", "OEM_PARTNER"]),
    reopen: can(["ADMIN", "STATE_HEAD"]),
    masterWrite: can(["ADMIN"]),
    masterView: can(["ADMIN", "AREA_MANAGER", "STATE_HEAD"]),
    security: can(["ADMIN"]),
    report: can(["ADMIN", "AREA_MANAGER", "STATE_HEAD", "OEM_PARTNER"]),
    import: can(["ADMIN"]),
    settings: can(["ADMIN"]),
    export: can(["ADMIN", "AREA_MANAGER", "STATE_HEAD", "OEM_PARTNER"]),
    analytics: can(["ADMIN", "AREA_MANAGER", "STATE_HEAD"]),
    allCompanies: can(["ADMIN", "CALL_CENTRE", "CALL_CLOSER"]),
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
  // Call centre defaults to every company they belong to. A chosen company is the restriction.
  if (user.caps.allCompanies) return { user, scope: "all" };
  return { user, scope: user.companyIds[0] ?? "all" };
});

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_FAIL_LIMIT = 5;

async function ipLocked(ip: string) {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const fails = await prisma.loginHistory.count({ where: { ip, success: false, at: { gte: since }, note: "failed" } });
  return fails >= LOGIN_FAIL_LIMIT;
}

export async function recordLogin(action: "LOGIN" | "LOGIN_FAILED" | "LOGIN_LOCKED", userId: string | undefined, summary: string) {
  await prisma.auditLog.create({
    data: { userId, entity: "Login", entityId: userId, action, summary: summary.slice(0, 240) },
  });
}

export async function login(email: string, password: string, meta: { ip?: string; userAgent?: string; totp?: string }) {
  const normalized = email.trim().toLowerCase();
  const ip = meta.ip;
  const agent = meta.userAgent?.slice(0, 240);
  if (ip && (await ipLocked(ip))) {
    await prisma.loginHistory.create({ data: { email: normalized, success: false, ip, userAgent: agent, note: "ip-locked" } });
    await recordLogin("LOGIN_LOCKED", undefined, `Too many sign-in attempts from ${ip}`);
    return { locked: true as const };
  }
  const user = await prisma.user.findUnique({ where: { email: normalized }, include: userInclude });
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    await prisma.loginHistory.create({ data: { userId: user.id, email: normalized, success: false, ip, userAgent: agent, note: "locked" } });
    await recordLogin("LOGIN_LOCKED", user.id, `Account locked for ${normalized}`);
    return { locked: true as const };
  }
  const ok = Boolean(user && user.active && (await bcrypt.compare(password, user.passwordHash)));
  await prisma.loginHistory.create({
    data: { userId: user?.id, email: normalized, success: ok, ip, userAgent: agent, note: ok ? null : "failed" },
  });
  if (!ok || !user) {
    if (user) {
      const failed = user.failedLogins + 1;
      const locked = failed >= LOGIN_FAIL_LIMIT;
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: failed, lockedUntil: locked ? new Date(Date.now() + LOGIN_WINDOW_MS) : null },
      });
      if (locked) {
        await prisma.loginHistory.create({ data: { userId: user.id, email: normalized, success: false, ip, note: "locked for 15 minutes" } });
        await recordLogin("LOGIN_LOCKED", user.id, `Account locked for 15 minutes after failed sign-in (${normalized})`);
      } else {
        await recordLogin("LOGIN_FAILED", user.id, `Failed sign-in for ${normalized}`);
      }
    } else {
      await recordLogin("LOGIN_FAILED", undefined, `Failed sign-in for ${normalized}`);
    }
    return null;
  }
  if (mustEnrolTotp(user.role, user.totpEnabled)) {
    return { setupTotp: true as const, userId: user.id };
  }
  if (user.totpEnabled) {
    const { totpMatches } = await import("./totp");
    if (!meta.totp) return { needsTotp: true as const };
    if (!user.totpSecret || !totpMatches(user.totpSecret, meta.totp)) {
      const failed = user.failedLogins + 1;
      const locked = failed >= LOGIN_FAIL_LIMIT;
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: failed, lockedUntil: locked ? new Date(Date.now() + LOGIN_WINDOW_MS) : null },
      });
      await prisma.loginHistory.create({ data: { userId: user.id, email: normalized, success: false, ip, userAgent: agent, note: "failed" } });
      await recordLogin(locked ? "LOGIN_LOCKED" : "LOGIN_FAILED", user.id, `Wrong authenticator code for ${normalized}`);
      if (locked) return { locked: true as const };
      return { needsTotp: true as const };
    }
  }
  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  await recordLogin("LOGIN", user.id, `Signed in (${normalized})`);
  return openSession(user.id);
}

/** Forced enrolment is off for every role unless ADMIN_2FA_ENFORCE=1. A grace time still skips it. A user who already turned the authenticator on is unchanged. */
export function mustEnrolTotp(role: string, totpEnabled: boolean) {
  if (totpEnabled) return false;
  if (process.env.ADMIN_2FA_ENFORCE !== "1") return false;
  if (role !== "ADMIN" && role !== "STATE_HEAD") return false;
  const graceUntil = process.env.ADMIN_2FA_GRACE_UNTIL ? new Date(process.env.ADMIN_2FA_GRACE_UNTIL) : null;
  if (graceUntil && !Number.isNaN(graceUntil.getTime()) && graceUntil.getTime() > Date.now()) return false;
  return true;
}

export async function issueTotpSetup(userId: string) {
  const token = randomBytes(32).toString("hex");
  const totpSetupHash = createHash("sha256").update(token).digest("hex");
  await prisma.user.update({
    where: { id: userId },
    data: { totpSetupHash, totpSetupExpires: new Date(Date.now() + 10 * 60 * 1000), failedLogins: 0, lockedUntil: null },
  });
  return token;
}

export async function userForTotpSetup(token: string | undefined) {
  if (!token) return null;
  const totpSetupHash = createHash("sha256").update(token).digest("hex");
  return prisma.user.findFirst({
    where: { totpSetupHash, totpSetupExpires: { gt: new Date() } },
  });
}

export function importTokenOk(header: string | null) {
  const expected = process.env.IMPORT_TOKEN ?? "";
  if (!expected || !header) return false;
  const left = Buffer.from(header);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Admin user for a trusted import client. The token never grants any other route. */
export async function userForImport() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", active: true }, include: userInclude });
  if (!admin) return null;
  return { user: toSessionUser(admin), scope: "all" as const };
}

export async function openSession(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: userInclude });
  if (!user || !user.active) return null;
  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  await prisma.session.create({ data: { token, userId: user.id, expiresAt: new Date(Date.now() + 7 * 86400000) } });
  return { token, user: toSessionUser(user) };
}

export async function logout(token: string | undefined) {
  if (!token) return;
  await prisma.session.deleteMany({ where: { token } });
}
