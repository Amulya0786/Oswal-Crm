import { NextResponse } from "next/server";
import { withUser, readJson } from "@/server/http";
import { actOnComplaint } from "@/server/complaints";

export const POST = withUser(async (user, request, context) => {
  const { id } = await context.params;
  const body = await readJson<Record<string, unknown>>(request);
  await actOnComplaint(id, user, body);
  return NextResponse.json({ ok: true });
});
