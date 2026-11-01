import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { readJson, withUser } from "@/server/http";

export const POST = withUser(async (user, request) => {
  if (!can(user.role, "manageTemplates")) throw new AppError("Only an admin can change templates.", 403);
  const body = await readJson<{ id?: string; subject?: string; body?: string; active?: boolean }>(request);
  if (!body.id || !body.body?.trim()) throw new AppError("Template text is required.");
  await prisma.notificationTemplate.update({
    where: { id: body.id },
    data: { subject: body.subject?.trim() || null, body: body.body.trim(), active: body.active !== false },
  });
  return NextResponse.json({ ok: true });
});
