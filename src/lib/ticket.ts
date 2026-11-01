import { yyMMdd } from "./time";

/** OPL + YYMMDD + sequence. Three digits through 999. From 1000 the same day uses 4 or more digits (OPL2611011000). That longer number is valid. */
export function formatTicketNo(date: Date, seq: number) {
  const key = yyMMdd(date);
  const width = seq > 999 ? String(seq).length : 3;
  return `OPL${key}${String(seq).padStart(width, "0")}`;
}

export function parseTicketNo(ticket: string): { dateKey: string; seq: number } | null {
  const match = /^OPL(\d{6})(\d{3,})$/.exec(ticket.trim().toUpperCase());
  if (!match) return null;
  return { dateKey: match[1], seq: Number(match[2]) };
}

export const RESERVED_TICKETS = new Set(["OPL261031365", "OPL261030368", "OPL261027102"]);
