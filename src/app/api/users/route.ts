import { NextResponse } from "next/server";
import { readJson, withUser } from "@/server/http";
import { createUser } from "@/server/users";

export const POST = withUser(async (user, request) => {
  const body = await readJson<{ name?: string; email?: string; phone?: string; employeeCode?: string; role?: string; password?: string }>(request);
  return NextResponse.json(await createUser(user, body));
});
