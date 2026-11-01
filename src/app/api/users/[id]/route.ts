import { NextResponse } from "next/server";
import { readJson, withUser } from "@/server/http";
import { updateUser } from "@/server/users";

export const PATCH = withUser(async (user, request, context) => {
  const { id } = await context.params;
  const body = await readJson<{ name?: string; email?: string; phone?: string; role?: string; active?: boolean; password?: string }>(request);
  await updateUser(user, id, body);
  return NextResponse.json({ ok: true });
});
