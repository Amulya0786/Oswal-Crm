import { istMidnight, parseLooseDate } from "./time";
import { normalizeStatus } from "./labels";

/** History starts on this book date. Not a rolling year. */
export const DEFAULT_HISTORY_CUTOFF = "2026-04-01";

export const IMPORT_BATCH = 100;

export function resolveHistoryCutoff(input?: string | null, envValue?: string | null) {
  const raw = (input || envValue || DEFAULT_HISTORY_CUTOFF).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) throw new Error("Cutoff must be YYYY-MM-DD");
  return istMidnight(Number(match[1]), Number(match[2]), Number(match[3]));
}

export type HistoryDecision = "keep" | "before-cutoff" | "no-date";

export function classifyHistoryDate(value: unknown, cutoff: Date): HistoryDecision {
  const bookDate = value instanceof Date ? value : parseLooseDate(value);
  if (!bookDate) return "no-date";
  return bookDate.getTime() >= cutoff.getTime() ? "keep" : "before-cutoff";
}

export function tallyHistory(dates: unknown[], cutoff: Date) {
  const tally = { keep: 0, skipped: 0, undated: 0 };
  for (const value of dates) {
    const decision = classifyHistoryDate(value, cutoff);
    if (decision === "keep") tally.keep++;
    else if (decision === "before-cutoff") tally.skipped++;
    else tally.undated++;
  }
  return tally;
}

/**
 * SmartLogics pending export: "Pending" is an open complaint, "Assigned" is assigned,
 * and "Job on Hold" is the desk's Pending status. Other values stay on the closed-history rules.
 */
export function openImportStatus(statusText: string | null | undefined) {
  const raw = (statusText ?? "").trim().toLowerCase().replace(/[_]+/g, " ").replace(/\s+/g, " ");
  if (raw === "pending") return { status: "OPEN", closed: false, happy: false };
  if (raw === "assigned") return { status: "ASSIGNED", closed: false, happy: false };
  if (raw === "job on hold" || raw === "on hold") return { status: "PENDING", closed: false, happy: false };
  return closedHistory(statusText);
}

/** Closed and Happy Calling Done are both finished history, not live calls. */
export function closedHistory(statusText: string | null | undefined) {
  const normalised = normalizeStatus(statusText);
  const raw = (statusText ?? "").trim().toLowerCase();
  if (normalised === "HAPPY_CALLING" || raw.includes("happy")) {
    return { status: "HAPPY_CALLING", closed: true, happy: true };
  }
  if (normalised === "CLOSED" || raw.includes("closed")) {
    return { status: "CLOSED", closed: true, happy: false };
  }
  return { status: normalised ?? "OPEN", closed: false, happy: false };
}

export function chunkRows<T>(rows: T[], size = IMPORT_BATCH) {
  const batches: T[][] = [];
  for (let index = 0; index < rows.length; index += size) batches.push(rows.slice(index, index + size));
  return batches;
}
