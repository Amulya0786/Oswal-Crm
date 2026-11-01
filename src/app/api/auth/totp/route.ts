import { prisma } from "@/server/db";
import { json } from "@/server/http";
import { newTotpSecret, totpMatches, totpUri } from "@/server/totp";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId ?? "");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || (user.role !== "ADMIN" && user.role !== "STATE_HEAD")) return json({ error: "Admin or state head only" }, 403);
  if (body.secret && body.code) {
    if (!totpMatches(String(body.secret), String(body.code))) return json({ error: "That code does not match" }, 400);
    await prisma.user.update({ where: { id: user.id }, data: { totpSecret: String(body.secret), totpEnabled: true } });
    return json({ ok: true });
  }
  const secret = newTotpSecret();
  return json({ secret, uri: totpUri(user.email, secret) });
}
