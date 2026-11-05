import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = [
  "/login",
  "/track",
  "/book",
  "/api/auth/login",
  "/api/auth/totp",
  "/totp",
  "/api/public",
  "/api/v1",
  "/api/health",
  "/api/cron",
  "/api/report",
  "/chat",
];

/** The import client has no session cookie. The route checks x-import-token. */
export function importRequestWithoutSession(method: string, pathname: string, hasImportToken: boolean) {
  if (!hasImportToken) return false;
  if (method === "GET" && pathname === "/api/desk/import/stats") return true;
  if (method !== "POST") return false;
  return pathname === "/api/desk/import/preview" || pathname === "/api/desk/import/commit";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (importRequestWithoutSession(request.method, pathname, Boolean(request.headers.get("x-import-token")))) return NextResponse.next();
  if (PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return NextResponse.next();
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/brand/") ||
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/icon" ||
    pathname === "/apple-icon" ||
    pathname === "/icon.svg" ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.png" ||
    pathname === "/robots.txt"
  ) return NextResponse.next();
  if (!request.cookies.get("oswal_session")) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sign in" }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = { matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"] };
