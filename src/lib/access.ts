import type { Role } from "@/lib/types";

const BLOCKED: Partial<Record<Role, string[]>> = {
  CALL_CENTRE: ["/masters", "/reports", "/import", "/settings", "/security", "/connect", "/map", "/attendance", "/performance", "/assist", "/analytics", "/exports"],
  OEM_PARTNER: ["/masters", "/settings", "/security", "/import", "/connect", "/map", "/attendance", "/performance", "/assist", "/analytics"],
};

export function pathAllowed(role: Role, pathname: string) {
  const list = BLOCKED[role] ?? [];
  return !list.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
