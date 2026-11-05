import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { fail } from "@/server/http";
import { newPasswordError } from "@/lib/password-rule";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in" }, { status: 401 });
    const body = await req.json();
    const next = String(body.password ?? "");
    const current = String(body.current ?? "");
    const row = await prisma.user.findUnique({ where: { id: user.id } });
    if (!row || !(await bcrypt.compare(current, row.passwordHash))) {
      return NextResponse.json({ error: "Current password is wrong" }, { status: 400 });
    }
    const problem = newPasswordError(next, await bcrypt.compare(next, row.passwordHash));
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(next, 10), mustChangePassword: false },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
