import { OPEN_WORK_STATUSES, TERMINAL_STATUSES } from "./constants";

const TRANSITIONS: Record<string, string[]> = {
  OPEN: ["ASSIGNED", "PENDING", "CANCELLED"],
  ASSIGNED: ["REASSIGNED", "PENDING", "CLOSED", "CANCELLED"],
  REASSIGNED: ["REASSIGNED", "PENDING", "CLOSED", "CANCELLED"],
  PENDING: ["ASSIGNED", "REASSIGNED", "OPEN", "CLOSED", "CANCELLED"],
  CLOSED: ["HAPPY_CALLING_DONE"],
  HAPPY_CALLING_DONE: [],
  CANCELLED: [],
};

export function assertTransition(from: string, to: string) {
  const allowed = TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`Cannot move a complaint from ${from} to ${to}.`);
  }
}

export function assignmentStatus(current: string, hasBeenAssigned: boolean) {
  if (current === "CANCELLED" || current === "CLOSED" || current === "HAPPY_CALLING_DONE") {
    throw new Error("This complaint can no longer be assigned.");
  }
  return hasBeenAssigned ? "REASSIGNED" : "ASSIGNED";
}

export function resumeStatus(hasAssignee: boolean) {
  return hasAssignee ? "ASSIGNED" : "OPEN";
}

export function isOpenWork(status: string) {
  return (OPEN_WORK_STATUSES as readonly string[]).includes(status);
}

export function isTerminal(status: string) {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

export type DeskAction = "note" | "visit" | "assign" | "hold" | "resume" | "close" | "happy" | "cancel";

export function actionAllowedForStatus(action: DeskAction, status: string) {
  if (action === "note") return true;
  if (action === "visit") return isOpenWork(status);
  if (action === "assign") return ["OPEN", "ASSIGNED", "REASSIGNED", "PENDING"].includes(status);
  if (action === "hold") return ["OPEN", "ASSIGNED", "REASSIGNED"].includes(status);
  if (action === "resume") return status === "PENDING";
  if (action === "close") return ["ASSIGNED", "REASSIGNED", "PENDING"].includes(status);
  if (action === "happy") return status === "CLOSED";
  if (action === "cancel") return !isTerminal(status);
  return false;
}
