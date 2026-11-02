import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { json } from "@/server/http";
import { openSession, userForTotpSetup } from "@/server/auth";
import { newTotpSecret, totpMatches, totpUri } from "@/server/totp";

const LIMIT = 8;

async function tooMany(userId: string) {
  const since = new Date(Date.now() - 10 * 60 * 1000);
  const count = await prisma.otpChallenge.count({ where: { phone: userId, purpose: "TOTP_SETUP", createdAt: { gt: since } } });
  if (count >= LIMIT) return true;
  await prisma.otpChallenge.create({
    data: { phone: userId, code: "setup", purpose: "TOTP_SETUP", expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });
  return false;
}

export async function POST(req: Request) {
  const token = (await cookies()).get("oswal_totp_setup")?.value;
  const user = await userForTotpSetup(token);
  if (!user) return json({ error: "Sign in again to set up the authenticator" }, 401);
  if (user.totpEnabled) return json({ error: "Authenticator is already on. Sign in with the code." }, 400);
  if (await tooMany(user.id)) return json({ error: "Too many attempts. Sign in again in a few minutes." }, 429);
  const body = await req.json().catch(() => ({}));
  if (body.code) {
    if (!user.totpSecret || !totpMatches(user.totpSecret, String(body.code))) {
      return json({ error: "That code does not match" }, 400);
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { totpEnabled: true, totpSetupHash: null, totpSetupExpires: null },
    });
    const session = await openSession(user.id);
    if (!session) return json({ error: "Could not open the desk" }, 500);
    const response = NextResponse.json({ ok: true });
    response.cookies.set("oswal_totp_setup", "", { httpOnly: true, path: "/", maxAge: 0 });
    response.cookies.set("oswal_session", session.token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
    if (session.user.caps.allCompanies) response.cookies.set("oswal_company", "all", { httpOnly: false, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    else if (session.user.companyIds[0]) response.cookies.set("oswal_company", session.user.companyIds[0], { httpOnly: false, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    return response;
  }
  const secret = user.totpSecret ?? newTotpSecret();
  if (!user.totpSecret) await prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret } });
  return json({ secret, uri: totpUri(user.email, secret) });
}
