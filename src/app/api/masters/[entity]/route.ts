import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { can } from "@/lib/rbac";
import { withUser, readJson } from "@/server/http";
import { createMaster, listMaster } from "@/server/masters/service";

export const GET = withUser(async (user, request, context) => {
  const { entity } = await context.params;
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1") || 1;
  const q = url.searchParams.get("q") ?? "";
  return NextResponse.json(await listMaster(entity, q, page));
});

export const POST = withUser(async (user, request, context) => {
  if (!can(user.role, "manageMasters")) throw new AppError("Only an admin can change masters.", 403);
  const { entity } = await context.params;
  const body = await readJson<Record<string, unknown>>(request);
  const created = await createMaster(entity, body, user.id);
  return NextResponse.json({ id: created.id });
});
