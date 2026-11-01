import { NextResponse } from "next/server";
import { login } from "@/server/auth";
import { clientIp, fail } from "@/server/http";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await login(String(body.email ?? ""), String(body.password ?? ""), {
      ip: clientIp(req) ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
      totp: body.totp ? String(body.totp) : undefined,
    });
    if (!result) return NextResponse.json({ error: "Email or password is wrong" }, { status: 401 });
    if ("locked" in result) return NextResponse.json({ error: "This account is locked for 15 minutes" }, { status: 423 });
    if ("needsTotp" in result) return NextResponse.json({ needsTotp: true }, { status: 401 });
    if ("setupTotp" in result) return NextResponse.json({ setupTotp: true, userId: result.userId }, { status: 403 });
    const response = NextResponse.json({ ok: true, name: result.user.name, role: result.user.role, mustChangePassword: result.user.mustChangePassword });
    response.cookies.set("oswal_session", result.token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
    if (result.user.caps.allCompanies) response.cookies.set("oswal_company", "all", { httpOnly: false, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    else if (result.user.companyIds[0]) response.cookies.set("oswal_company", result.user.companyIds[0], { httpOnly: false, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    return response;
  } catch (error) {
    return fail(error);
  }
}
