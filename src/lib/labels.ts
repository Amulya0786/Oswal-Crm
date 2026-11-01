export const CALL_TYPES = [
  { id: "BREAKDOWN", label: "Breakdown" },
  { id: "INSTALLATION", label: "Installation" },
  { id: "INSURANCE", label: "Insurance" },
  { id: "MOBILE_APP", label: "Mobile App" },
  { id: "SCHEME", label: "Scheme" },
] as const;

export const STATUSES = [
  { id: "OPEN", label: "Open" },
  { id: "ASSIGNED", label: "Assigned" },
  { id: "REASSIGNED", label: "Re-Assigned" },
  { id: "PENDING", label: "Pending" },
  { id: "CLOSED", label: "Closed" },
  { id: "CLOSED_UNVERIFIED", label: "Closed - Unverified" },
  { id: "HAPPY_CALLING", label: "Happy Calling Done" },
  { id: "CANCELLED", label: "Cancelled" },
] as const;

export const PRIORITIES = [
  { id: "LOW", label: "Low" },
  { id: "NORMAL", label: "Normal" },
  { id: "HIGH", label: "High" },
  { id: "URGENT", label: "Urgent" },
] as const;

export const SOURCES = [
  { id: "CALL", label: "Call" },
  { id: "WHATSAPP", label: "WhatsApp" },
  { id: "WEB", label: "Web form" },
  { id: "DEALER", label: "Dealer" },
  { id: "QR", label: "QR link" },
] as const;

export const ACTIVE_STATUSES = ["OPEN", "ASSIGNED", "REASSIGNED", "PENDING"] as const;

export const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  CALL_CENTRE: "Call centre",
  AREA_MANAGER: "Area manager",
  STATE_HEAD: "State head",
  TECHNICIAN: "Technician",
  DEALER: "Dealer",
};

export function labelOf(list: readonly { id: string; label: string }[], id: string | null | undefined) {
  if (!id) return "—";
  return list.find((item) => item.id === id)?.label ?? id;
}

export function statusClass(status: string) {
  switch (status) {
    case "OPEN":
      return "stamp info";
    case "ASSIGNED":
      return "stamp copper";
    case "REASSIGNED":
      return "stamp violet";
    case "PENDING":
      return "stamp amber";
    case "CLOSED":
      return "stamp good";
    case "CLOSED_UNVERIFIED":
      return "stamp amber";
    case "HAPPY_CALLING":
      return "stamp teal";
    case "CANCELLED":
      return "stamp stone";
    default:
      return "stamp";
  }
}

export const DEFAULT_SLA_HOURS: Record<string, number> = {
  BREAKDOWN: 48,
  INSTALLATION: 120,
  INSURANCE: 168,
  MOBILE_APP: 72,
  SCHEME: 240,
};

export function normalizeStatus(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = input.trim().toLowerCase().replace(/[_]+/g, " ").replace(/\s+/g, " ");
  const map: Record<string, string> = {
    open: "OPEN",
    assigned: "ASSIGNED",
    "re-assigned": "REASSIGNED",
    "re assigned": "REASSIGNED",
    reassigned: "REASSIGNED",
    pending: "PENDING",
    closed: "CLOSED",
    "closed - unverified": "CLOSED_UNVERIFIED",
    "closed unverified": "CLOSED_UNVERIFIED",
    "job on hold": "PENDING",
    "on hold": "PENDING",
    "happy calling done": "HAPPY_CALLING",
    "happy calling": "HAPPY_CALLING",
    happycalling: "HAPPY_CALLING",
    cancelled: "CANCELLED",
    canceled: "CANCELLED",
  };
  return map[s] ?? null;
}

export function normalizeCallType(input: string | null | undefined): string {
  const s = (input ?? "").trim().toLowerCase();
  if (s.includes("break")) return "BREAKDOWN";
  if (s.includes("install")) return "INSTALLATION";
  if (s.includes("insur")) return "INSURANCE";
  if (s.includes("mobile") || s.includes("app")) return "MOBILE_APP";
  if (s.includes("scheme") || s.includes("kusum") || s.includes("msedcl")) return "SCHEME";
  return "BREAKDOWN";
}

export function normalizePriority(input: string | null | undefined): string {
  const s = (input ?? "").trim().toLowerCase();
  if (s.startsWith("urg")) return "URGENT";
  if (s.startsWith("hi")) return "HIGH";
  if (s.startsWith("lo")) return "LOW";
  return "NORMAL";
}

export function normalizeSource(input: string | null | undefined): string {
  const s = (input ?? "").trim().toLowerCase();
  if (s.includes("whats")) return "WHATSAPP";
  if (s.includes("qr")) return "QR";
  if (s.includes("web")) return "WEB";
  if (s.includes("dealer")) return "DEALER";
  if (s.includes("call")) return "CALL";
  return s ? s.toUpperCase().slice(0, 24) : "CALL";
}
