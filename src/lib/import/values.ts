const STATUS_MAP: Record<string, string> = {
  open: "OPEN",
  assigned: "ASSIGNED",
  "re-assigned": "REASSIGNED",
  reassigned: "REASSIGNED",
  "re assigned": "REASSIGNED",
  pending: "PENDING",
  "on hold": "PENDING",
  hold: "PENDING",
  closed: "CLOSED",
  "happy calling done": "HAPPY_CALLING_DONE",
  "happy calling": "HAPPY_CALLING_DONE",
  cancelled: "CANCELLED",
  canceled: "CANCELLED",
};

const TYPE_MAP: Record<string, { type: string; scheme?: string }> = {
  breakdown: { type: "BREAKDOWN" },
  bd: { type: "BREAKDOWN" },
  installation: { type: "INSTALLATION" },
  install: { type: "INSTALLATION" },
  insurance: { type: "INSURANCE" },
  "mobile app": { type: "MOBILE_APP" },
  "mobile application": { type: "MOBILE_APP" },
  mobile: { type: "MOBILE_APP" },
  scheme: { type: "SCHEME" },
  msedcl: { type: "SCHEME", scheme: "MSEDCL" },
  kusum: { type: "SCHEME", scheme: "KUSUM" },
};

const ROLE_MAP: Record<string, string> = {
  admin: "ADMIN",
  "call centre": "CALL_CENTRE",
  "call center": "CALL_CENTRE",
  callcentre: "CALL_CENTRE",
  "area manager": "AREA_MANAGER",
  "state head": "STATE_HEAD",
  technician: "TECHNICIAN",
  engineer: "TECHNICIAN",
  dealer: "DEALER",
};

const SOURCE_MAP: Record<string, string> = {
  call: "CALL",
  phone: "CALL",
  whatsapp: "WHATSAPP",
  "whats app": "WHATSAPP",
  "web form": "WEB_FORM",
  web: "WEB_FORM",
  website: "WEB_FORM",
  dealer: "DEALER",
  qr: "QR",
  "qr link": "QR",
  "qr code": "QR",
};

function norm(value: string) {
  return value.trim().toLowerCase().replace(/[_/]+/g, " ").replace(/\s+/g, " ");
}

export function mapStatus(value: string) {
  return STATUS_MAP[norm(value)] ?? null;
}

export function mapType(value: string) {
  return TYPE_MAP[norm(value)] ?? null;
}

export function mapRole(value: string) {
  const normalized = norm(value);
  return ROLE_MAP[normalized] ?? (["ADMIN", "CALL_CENTRE", "AREA_MANAGER", "STATE_HEAD", "TECHNICIAN", "DEALER"].includes(value.trim()) ? value.trim() : null);
}

export function mapSource(value: string) {
  const normalized = norm(value);
  return SOURCE_MAP[normalized] ?? null;
}
