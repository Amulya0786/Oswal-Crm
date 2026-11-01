import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { can } from "@/lib/rbac";
import { withUser, readJson } from "@/server/http";
import { deleteMaster, updateMaster } from "@/server/masters/service";

export const PATCH = withUser(async (user, request, context) => {
  if (!can(user.role, "manageMasters")) throw new AppError("Only an admin can change masters.", 403);
  const { entity, id } = await context.params;
  const body = await readJson<Record<string, unknown>>(request);
  await updateMaster(entity, id, body, user.id);
  return NextResponse.json({ ok: true });
});

export const DELETE = withUser(async (user, _request, context) => {
  if (!can(user.role, "manageMasters")) throw new AppError("Only an admin can change masters.", 403);
  const { entity, id } = await context.params;
  await deleteMaster(entity, id, user.id);
  return NextResponse.json({ ok: true });
});
