import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { logout } from "@/server/auth";

export async function POST() {
  const token = (await cookies()).get("oswal_session")?.value;
  await logout(token);
  const response = NextResponse.json({ ok: true });
  response.cookies.set("oswal_session", "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
