import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { AccessUser } from "@/lib/permissions";

export type CurrentUser = AccessUser & {
  name: string;
  email: string;
  employeeCode: string;
  phone: string | null;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.uid },
    include: { stateAccess: true, districtAccess: true, brandAccess: true },
  });
  if (!user?.active) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    employeeCode: user.employeeCode,
    phone: user.phone,
    stateIds: user.stateAccess.map((row) => row.stateId),
    districtIds: user.districtAccess.map((row) => row.districtId),
    brandIds: user.brandAccess.map((row) => row.brandId),
  };
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
