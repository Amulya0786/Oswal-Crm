import { istMidnight, kolkataYmd, parseLooseDate, zoned } from "./time";

const PLACEHOLDERS = new Set([
  "0", "00", "000", "0000", "123", "1234", "12345", "123456", "1234567", "12345678", "123456789",
  "765432", "7654321", "1111", "2222", "9999", "NO", "NA", "NIL", "NONE", "N/A", "TEST", "NULL", "XXXX",
]);

export function normaliseSerial(input: string | null | undefined) {
  return String(input ?? "").trim().toUpperCase().replace(/[\s._,\-/]+/g, "");
}

export const SERIAL_UNAVAILABLE_REASONS = [
  { id: "STICKER_MISSING", label: "Sticker missing or damaged" },
  { id: "CUSTOMER_ABSENT", label: "Customer not at site" },
  { id: "SCHEME", label: "Scheme beneficiary" },
  { id: "OTHER", label: "Other" },
] as const;

export function serialReasonLabel(id: string | null | undefined) {
  return SERIAL_UNAVAILABLE_REASONS.find((item) => item.id === id)?.label ?? id ?? "";
}

/** Empty is allowed only through resolveSerial. A value, if present, must be a real serial. */
export function validateSerial(input: string | null | undefined): { ok: true; serial: string } | { ok: false; reason: string } {
  const serial = normaliseSerial(input);
  if (!serial) return { ok: false, reason: "Enter a serial, or mark it as not available" };
  if (serial.length < 5) return { ok: false, reason: "Serial is too short" };
  if (serial.length > 40) return { ok: false, reason: "Serial is too long" };
  if (PLACEHOLDERS.has(serial) || /^0+$/.test(serial)) return { ok: false, reason: "That serial looks like a placeholder" };
  if (/^(\d)\1+$/.test(serial) || /^(.)\1{4,}$/.test(serial)) return { ok: false, reason: "Serial cannot be a repeated character" };
  if (/^123456/.test(serial) || serial === "0123456789") return { ok: false, reason: "Serial looks sequential" };
  if (!/^[A-Z0-9]+$/.test(serial)) return { ok: false, reason: "Serial can only use letters and numbers" };
  return { ok: true, serial };
}

export function resolveSerial(input: { serial?: string | null; unavailable?: boolean; reason?: string | null }):
  | { ok: true; serial: string | null; pending: boolean; reason: string | null }
  | { ok: false; reason: string } {
  const raw = String(input.serial ?? "").trim();
  if (!raw) {
    if (!input.unavailable) return { ok: false, reason: "Enter the serial, or tick Serial not available and choose a reason" };
    const known = SERIAL_UNAVAILABLE_REASONS.some((item) => item.id === input.reason);
    if (!known) return { ok: false, reason: "Choose why the serial is not available" };
    return { ok: true, serial: null, pending: true, reason: String(input.reason) };
  }
  const checked = validateSerial(raw);
  if (!checked.ok) return checked;
  return { ok: true, serial: checked.serial, pending: false, reason: null };
}

/** 5HP, 5, 7.5HP-DC and 10 HP DC SURFACE all become "5 HP" / "7.5 HP" / "10 HP". */
export function normaliseCapacity(input: string | null | undefined): string | null {
  if (!input || !String(input).trim()) return null;
  let text = String(input).trim().toUpperCase().replace(/–/g, "-");
  text = text.replace(/DC\s*SURFACE|SURFACE|HP-DC|HPDC|-DC|\bDC\b/g, " ");
  text = text.replace(/HP/g, " ");
  const match = text.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0 || value > 100) return null;
  const label = Number.isInteger(value) ? String(value) : String(value);
  return `${label} HP`;
}

export function normaliseHead(input: string | null | undefined): string | null {
  if (!input || !String(input).trim()) return null;
  const match = String(input).match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return `${match[1]} m`;
}

const FUTURE_HOLD_MS = 18 * 3600 * 1000;
const FUTURE_SCHEDULE_MS = 14 * 24 * 3600 * 1000;

export function assertWorkDate(kind: "hold" | "schedule" | "solved", value: Date, bookDate: Date, now = new Date()) {
  const bookDay = istMidnight(kolkataYmd(bookDate).y, kolkataYmd(bookDate).m, kolkataYmd(bookDate).d);
  if (value.getTime() + 60_000 < bookDay.getTime()) {
    throw new Error(`${kind} date cannot be before the booking date`);
  }
  const limit = kind === "schedule" ? now.getTime() + FUTURE_SCHEDULE_MS : now.getTime() + FUTURE_HOLD_MS;
  if (value.getTime() > limit) {
    throw new Error(kind === "schedule" ? "Schedule date is too far ahead" : `${kind} date cannot be in the future`);
  }
}

/**
 * Indian desks export dates as dd-mm-yyyy. If both numbers are <= 12 the order is ambiguous
 * and the row is flagged. A first number above 12 must be the day. A second number above 12
 * must be a US-style month-first date.
 */
export function parseImportedDate(value: unknown): { date: Date | null; suspect: boolean; note?: string } {
  if (value == null || value === "") return { date: null, suspect: false };
  if (value instanceof Date && !Number.isNaN(value.getTime())) return { date: value, suspect: false };
  if (typeof value === "number") return { date: parseLooseDate(value), suspect: false };
  const text = String(value).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return { date: parseLooseDate(text), suspect: false };
  const parts = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(text);
  if (!parts) {
    const fallback = parseLooseDate(text);
    return { date: fallback, suspect: Boolean(fallback), note: fallback ? "Unrecognised date shape" : "Could not read the date" };
  }
  const a = Number(parts[1]);
  const b = Number(parts[2]);
  const year = Number(parts[3]);
  if (a > 12 && b <= 12) return { date: zoned(year, b, a, 10, 0), suspect: false };
  if (b > 12 && a <= 12) return { date: zoned(year, a, b, 10, 0), suspect: false, note: "Read as month-first because the second number is above 12" };
  if (a > 12 && b > 12) return { date: null, suspect: true, note: "Neither number can be a month" };
  return { date: zoned(year, b, a, 10, 0), suspect: true, note: "Ambiguous day and month; stored as dd-mm-yyyy" };
}

export const PROBLEM_CATEGORIES = [
  "Controller", "RMS", "App", "SIM", "Motor", "Pump", "Panel", "Wiring", "Structure",
  "Display", "Leakage", "Bearing", "Cable", "Dry run", "Installation", "Communication", "VFD", "Earthing", "Other",
];

export function channelFor(callType: string) {
  return callType === "MOBILE_APP" ? "APP" : "FIELD";
}
