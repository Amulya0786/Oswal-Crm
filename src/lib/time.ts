const IST = "Asia/Kolkata";

export function kolkataYmd(date = new Date()): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** Clock time in India, stored as a UTC instant. Month is 1-12. */
export function zoned(year: number, month: number, day: number, hour = 10, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - 5.5 * 3600 * 1000);
}

export function istMidnight(year: number, month: number, day: number) {
  return zoned(year, month, day, 0, 0);
}

export function shiftYmd(y: number, m: number, d: number, days: number) {
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return { y: utc.getUTCFullYear(), m: utc.getUTCMonth() + 1, d: utc.getUTCDate() };
}

export function midnightShift(now: Date, days: number) {
  const t = kolkataYmd(now);
  const s = shiftYmd(t.y, t.m, t.d, days);
  return istMidnight(s.y, s.m, s.d);
}

export function kolkataTodayStart(now = new Date()) {
  return midnightShift(now, 0);
}

export function kolkataMonthStart(now = new Date()) {
  const t = kolkataYmd(now);
  return istMidnight(t.y, t.m, 1);
}

export function kolkataNextMonthStart(now = new Date()) {
  const t = kolkataYmd(now);
  const m = t.m === 12 ? 1 : t.m + 1;
  const y = t.m === 12 ? t.y + 1 : t.y;
  return istMidnight(y, m, 1);
}

export function ageDays(bookDate: Date, end: Date = new Date()) {
  const a = kolkataYmd(bookDate);
  const b = kolkataYmd(end);
  const utcA = Date.UTC(a.y, a.m - 1, a.d);
  const utcB = Date.UTC(b.y, b.m - 1, b.d);
  return Math.round((utcB - utcA) / 86400000);
}

/** One ageing standard: 0–7, 8–15, 16–30, and older than 30 days. */
export const AGE_BUCKETS = [
  { id: "0-7", label: "0–7 days" },
  { id: "8-15", label: "8–15 days" },
  { id: "16-30", label: "16–30 days" },
  { id: "30+", label: "30+ days" },
] as const;

export function ageingBounds(bucket: string, now = new Date()): { gte?: Date; lt?: Date } | null {
  if (bucket === "0-7") return { gte: midnightShift(now, -7), lt: midnightShift(now, 1) };
  if (bucket === "8-15") return { gte: midnightShift(now, -15), lt: midnightShift(now, -7) };
  if (bucket === "16-30") return { gte: midnightShift(now, -30), lt: midnightShift(now, -15) };
  if (bucket === "30+" || bucket === "30p") return { lt: midnightShift(now, -30) };
  return null;
}

export function ageBucket(bookDate: Date, now = new Date()) {
  const days = ageDays(bookDate, now);
  if (days <= 7) return "0–7 days";
  if (days <= 15) return "8–15 days";
  if (days <= 30) return "16–30 days";
  return "30+ days";
}

export function yyMMdd(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}${get("month")}${get("day")}`;
}

export function formatWhen(input: string | Date | null | undefined) {
  if (!input) return "—";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatDay(input: string | Date | null | undefined) {
  if (!input) return "—";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

export function parseLooseDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
  }
  const s = String(value).trim();
  let match = /^(\d{1,2})[-/ ]([A-Za-z]{3,})[-/ ](\d{4})$/.exec(s);
  if (match) {
    const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
    if (!month) return null;
    return zoned(Number(match[3]), month, Number(match[1]), 10, 0);
  }
  match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (match) return zoned(Number(match[3]), Number(match[2]), Number(match[1]), 10, 0);
  match = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (match) return zoned(Number(match[1]), Number(match[2]), Number(match[3]), 10, 0);
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
