import type { Role } from "@/lib/types";

const ADMIN_ONLY = ["/health", "/import"];
const REMOVED = ["/leave", "/expenses", "/contracts"];

const BLOCKED: Partial<Record<Role, string[]>> = {
  CALL_CENTRE: ["/masters", "/reports", "/import", "/settings", "/security", "/connect", "/map", "/attendance", "/performance", "/assist", "/analytics", "/exports"],
  CALL_CLOSER: ["/masters", "/reports", "/import", "/settings", "/security", "/connect", "/map", "/attendance", "/performance", "/assist", "/analytics", "/exports"],
  OEM_PARTNER: ["/masters", "/settings", "/security", "/import", "/connect", "/map", "/attendance", "/performance", "/assist", "/analytics"],
};

export function pathAllowed(role: Role, pathname: string) {
  if (REMOVED.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return false;
  if (role !== "ADMIN" && ADMIN_ONLY.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return false;
  if (pathname === "/assign" || pathname.startsWith("/assign/")) {
    if (role !== "ADMIN" && role !== "STATE_HEAD" && role !== "AREA_MANAGER") return false;
  }
  if (pathname === "/map" || pathname.startsWith("/map/")) {
    if (role === "CALL_CENTRE" || role === "CALL_CLOSER" || role === "TECHNICIAN" || role === "OEM_PARTNER" || role === "DEALER") return false;
  }
  const list = BLOCKED[role] ?? [];
  return !list.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
