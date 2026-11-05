import { NextResponse } from "next/server";
import { getCurrentUser, issueTotpSetup } from "@/server/auth";
import { prisma } from "@/server/db";
import { json } from "@/server/http";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Sign in" }, 401);
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { totpEnabled: true } });
  if (!row) return json({ error: "Sign in" }, 401);
  if (row.totpEnabled) return json({ error: "Authenticator is already on." }, 400);
  const setup = await issueTotpSetup(user.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set("oswal_totp_setup", setup, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 10 });
  return response;
}
