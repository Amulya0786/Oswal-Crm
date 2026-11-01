import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const body = await req.json();
  const companyId = String(body.companyId ?? "");
  if (companyId === "all" && !user.caps.allCompanies) return NextResponse.json({ error: "Group view is for admins" }, { status: 403 });
  if (companyId !== "all" && !user.companyIds.includes(companyId)) return NextResponse.json({ error: "You do not have that company" }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set("oswal_company", companyId, { httpOnly: false, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return response;
}
