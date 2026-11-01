import { NextResponse } from "next/server";
import { readJson, withUser } from "@/server/http";
import { setPermissions } from "@/server/users";

export const PUT = withUser(async (user, request, context) => {
  const { id } = await context.params;
  const body = await readJson<{ stateIds?: string[]; districtIds?: string[]; brandIds?: string[] }>(request);
  await setPermissions(user, id, body);
  return NextResponse.json({ ok: true });
});
