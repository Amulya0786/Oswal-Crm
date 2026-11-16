import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { json } from "@/server/http";
import { passwordProblem } from "@/lib/password";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = String(body.token ?? "");
  const password = String(body.password ?? "");
  const resetTokenHash = createHash("sha256").update(token).digest("hex");
  const user = await prisma.user.findFirst({ where: { resetTokenHash, resetExpires: { gt: new Date() } } });
  if (!user) return json({ error: "This reset link has expired" }, 400);
  const problem = passwordProblem(password, user.name, user.phone, user.email);
  if (problem) return json({ error: problem }, 400);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 10), resetTokenHash: null, resetExpires: null, failedLogins: 0, lockedUntil: null, mustChangePassword: false },
  });
  return json({ ok: true });
}
