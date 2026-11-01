export const ROLES = [
  { value: "ADMIN", label: "Admin" },
  { value: "CALL_CENTRE", label: "Call Centre" },
  { value: "AREA_MANAGER", label: "Area Manager" },
  { value: "STATE_HEAD", label: "State Head" },
  { value: "TECHNICIAN", label: "Technician" },
  { value: "DEALER", label: "Dealer" },
] as const;

export const COMPLAINT_STATUSES = [
  { value: "OPEN", label: "Open" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "REASSIGNED", label: "Re-Assigned" },
  { value: "PENDING", label: "Pending" },
  { value: "CLOSED", label: "Closed" },
  { value: "HAPPY_CALLING_DONE", label: "Happy Calling Done" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

export const COMPLAINT_TYPES = [
  { value: "BREAKDOWN", label: "Breakdown" },
  { value: "INSTALLATION", label: "Installation" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "MOBILE_APP", label: "Mobile App" },
  { value: "SCHEME", label: "Scheme (MSEDCL/KUSUM)" },
] as const;

export const COMPLAINT_SOURCES = [
  { value: "CALL", label: "Call" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "WEB_FORM", label: "Web Form" },
  { value: "DEALER", label: "Dealer" },
  { value: "QR", label: "QR Link" },
] as const;

export const SCHEMES = [
  { value: "MSEDCL", label: "MSEDCL" },
  { value: "KUSUM", label: "KUSUM" },
] as const;

export const PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
] as const;

export const PRODUCT_FAMILIES = [
  { value: "Submersible", label: "Submersible" },
  { value: "Monoblock", label: "Monoblock" },
  { value: "Openwell", label: "Openwell" },
  { value: "Solar Surface", label: "Solar Surface" },
  { value: "Solar Submersible", label: "Solar Submersible" },
] as const;

export const OPEN_WORK_STATUSES = ["OPEN", "ASSIGNED", "REASSIGNED", "PENDING"] as const;
export const TERMINAL_STATUSES = ["CLOSED", "HAPPY_CALLING_DONE", "CANCELLED"] as const;

export const AGE_BUCKETS = [
  { value: "0-2", label: "0–2 days" },
  { value: "3-7", label: "3–7 days" },
  { value: "8-15", label: "8–15 days" },
  { value: "15+", label: "15+ days" },
] as const;

export function labelOf(list: readonly { value: string; label: string }[], value: string | null | undefined) {
  return list.find((item) => item.value === value)?.label ?? value ?? "—";
}

export const STATUS_TONE: Record<string, string> = {
  OPEN: "bg-sky-50 text-sky-800 ring-sky-200",
  ASSIGNED: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  REASSIGNED: "bg-violet-50 text-violet-800 ring-violet-200",
  PENDING: "bg-amber-50 text-amber-900 ring-amber-200",
  CLOSED: "bg-teal-50 text-teal-800 ring-teal-200",
  HAPPY_CALLING_DONE: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  CANCELLED: "bg-rose-50 text-rose-800 ring-rose-200",
};

export const TYPE_TONE: Record<string, string> = {
  BREAKDOWN: "bg-orange-50 text-orange-800 ring-orange-200",
  INSTALLATION: "bg-sky-50 text-sky-800 ring-sky-200",
  INSURANCE: "bg-violet-50 text-violet-800 ring-violet-200",
  MOBILE_APP: "bg-cyan-50 text-cyan-800 ring-cyan-200",
  SCHEME: "bg-emerald-50 text-emerald-800 ring-emerald-200",
};
