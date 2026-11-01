const ZONE = "Asia/Kolkata";

export function zonedParts(date: Date, timeZone = ZONE) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Midnight at the start of the IST calendar day, as a UTC Date. */
export function startOfDayIST(now = new Date()) {
  const p = zonedParts(now);
  return new Date(Date.UTC(p.year, p.month - 1, p.day, -5, -30, 0, 0));
}

export function startOfMonthIST(now = new Date()) {
  const p = zonedParts(now);
  return new Date(Date.UTC(p.year, p.month - 1, 1, -5, -30, 0, 0));
}

export function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 3600_000);
}

export function ageInDays(created: Date, now = new Date()) {
  const a = startOfDayIST(created).getTime();
  const b = startOfDayIST(now).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export type AgeBucket = "0-2" | "3-7" | "8-15" | "15+";

export function ageingBucket(created: Date, now = new Date()): AgeBucket {
  const days = ageInDays(created, now);
  if (days <= 2) return "0-2";
  if (days <= 7) return "3-7";
  if (days <= 15) return "8-15";
  return "15+";
}

/** Prisma createdAt filter matching ageingBucket. 15+ means more than 15 days so the four buckets partition open work. */
export function ageRange(bucket: string, now = new Date()): { gte?: Date; lt?: Date } | null {
  const start = startOfDayIST(now);
  const daysAgo = (n: number) => new Date(start.getTime() - n * 86_400_000);
  if (bucket === "0-2") return { gte: daysAgo(2) };
  if (bucket === "3-7") return { gte: daysAgo(7), lt: daysAgo(2) };
  if (bucket === "8-15") return { gte: daysAgo(15), lt: daysAgo(7) };
  if (bucket === "15+") return { lt: daysAgo(15) };
  return null;
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}
