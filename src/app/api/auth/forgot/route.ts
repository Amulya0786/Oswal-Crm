import { createHash, randomBytes } from "crypto";
import { prisma } from "@/server/db";
import { json } from "@/server/http";
import { sendMail } from "@/server/mail";
import { publicOrigin } from "@/lib/origin";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (user?.active) {
    const token = randomBytes(24).toString("hex");
    const resetTokenHash = createHash("sha256").update(token).digest("hex");
    await prisma.user.update({ where: { id: user.id }, data: { resetTokenHash, resetExpires: new Date(Date.now() + 30 * 60 * 1000) } });
    const link = `${publicOrigin()}/reset?token=${token}`;
    await sendMail(user.email, "Oswal Service password reset", `Open this link within 30 minutes to set a new password:\n${link}\n`);
  }
  return json({ ok: true });
}
