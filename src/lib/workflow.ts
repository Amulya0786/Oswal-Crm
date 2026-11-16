export const LIVE = ["OPEN", "ASSIGNED", "REASSIGNED", "PENDING"] as const;
export const RESOLVED = ["CLOSED", "CLOSED_UNVERIFIED", "HAPPY_CALLING"] as const;

const NEXT: Record<string, string[]> = {
  OPEN: ["ASSIGNED", "PENDING", "CANCELLED", "CLOSED", "CLOSED_UNVERIFIED"],
  ASSIGNED: ["ASSIGNED", "REASSIGNED", "PENDING", "CANCELLED", "CLOSED", "CLOSED_UNVERIFIED"],
  REASSIGNED: ["REASSIGNED", "ASSIGNED", "PENDING", "CANCELLED", "CLOSED", "CLOSED_UNVERIFIED"],
  PENDING: ["ASSIGNED", "REASSIGNED", "OPEN", "PENDING", "CANCELLED", "CLOSED", "CLOSED_UNVERIFIED"],
  CLOSED_UNVERIFIED: ["HAPPY_CALLING", "CLOSED"],
  CLOSED: ["HAPPY_CALLING"],
  HAPPY_CALLING: [],
  CANCELLED: ["OPEN", "ASSIGNED"],
};

export function assertTransition(from: string, to: string) {
  if (from === to && from === "PENDING") return;
  const allowed = NEXT[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`Cannot move a ${from} ticket to ${to}`);
  }
}

export function closureStatus(proof: "OTP" | "SATISFIED" | "NONE") {
  return proof === "NONE" ? "CLOSED_UNVERIFIED" : "CLOSED";
}

export function assertClosureShape(status: string, solvedAt: Date | null, solution: string | null) {
  const resolved = (RESOLVED as readonly string[]).includes(status);
  if (!resolved && solvedAt) throw new Error("An open ticket cannot have a solved date");
  if (resolved && !solvedAt) throw new Error("A closed ticket must have a solved date");
  if (resolved && !solution?.trim()) throw new Error("A closed ticket must have a solution");
}

export function isLowPerformer(tickets: number, closureRate: number) {
  if (tickets >= 20 && closureRate < 0.4) return true;
  if (tickets >= 10 && closureRate < 0.1) return true;
  return false;
}

/** Closed / (tickets − cancelled), matching the October MIS definition. */
export function closureRate(closed: number, tickets: number, cancelled: number) {
  const base = tickets - cancelled;
  if (base <= 0) return 0;
  return closed / base;
}
