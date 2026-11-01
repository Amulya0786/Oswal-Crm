import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { json } from "@/server/http";
import { openSession } from "@/server/auth";
import { newTotpSecret, totpMatches, totpUri } from "@/server/totp";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId ?? "");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || (user.role !== "ADMIN" && user.role !== "STATE_HEAD")) return json({ error: "Admin or state head only" }, 403);
  if (body.secret && body.code) {
    if (user.totpEnabled) return json({ error: "Authenticator is already on. Sign in with the code." }, 400);
    if (!totpMatches(String(body.secret), String(body.code))) return json({ error: "That code does not match" }, 400);
    await prisma.user.update({ where: { id: user.id }, data: { totpSecret: String(body.secret), totpEnabled: true } });
    const session = await openSession(user.id);
    if (!session) return json({ error: "Could not open the desk" }, 500);
    const response = NextResponse.json({ ok: true });
    response.cookies.set("oswal_session", session.token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
    if (session.user.caps.allCompanies) response.cookies.set("oswal_company", "all", { httpOnly: false, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    else if (session.user.companyIds[0]) response.cookies.set("oswal_company", session.user.companyIds[0], { httpOnly: false, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    return response;
  }
  if (user.totpEnabled) return json({ error: "Authenticator is already on" }, 400);
  const secret = newTotpSecret();
  return json({ secret, uri: totpUri(user.email, secret) });
}
