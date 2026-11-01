import { addHours } from "./time";
import { isOpenWork } from "./workflow";

export type SlaClock = {
  status: string;
  firstResponseAt?: Date | null;
  slaResponseDue?: Date | null;
  slaCloseDue?: Date | null;
  escalationLevel: number;
  lastEscalatedAt?: Date | null;
};

export function slaDueDates(createdAt: Date, responseHours: number, closeHours: number) {
  return {
    slaResponseDue: addHours(createdAt, responseHours),
    slaCloseDue: addHours(createdAt, closeHours),
  };
}

export function isResponseBreach(complaint: SlaClock, now = new Date()) {
  if (!isOpenWork(complaint.status)) return false;
  if (complaint.firstResponseAt) return false;
  if (!complaint.slaResponseDue) return false;
  return complaint.slaResponseDue.getTime() < now.getTime();
}

export function isCloseBreach(complaint: SlaClock, now = new Date()) {
  if (!isOpenWork(complaint.status)) return false;
  if (!complaint.slaCloseDue) return false;
  return complaint.slaCloseDue.getTime() < now.getTime();
}

export function isBreached(complaint: SlaClock, now = new Date()) {
  return isResponseBreach(complaint, now) || isCloseBreach(complaint, now);
}

export function nextEscalation(level: number): { level: number; role: string } | null {
  if (level <= 0) return { level: 1, role: "AREA_MANAGER" };
  if (level === 1) return { level: 2, role: "STATE_HEAD" };
  if (level === 2) return { level: 3, role: "ADMIN" };
  return null;
}

export function shouldEscalate(complaint: SlaClock, now: Date, cooldownHours: number, force = false) {
  if (!isBreached(complaint, now)) return false;
  if (!nextEscalation(complaint.escalationLevel)) return false;
  if (force) return true;
  if (!complaint.lastEscalatedAt) return true;
  return now.getTime() - complaint.lastEscalatedAt.getTime() >= cooldownHours * 3600_000;
}

export const DEFAULT_SLA: Record<string, { responseHours: number; closeHours: number }> = {
  BREAKDOWN: { responseHours: 4, closeHours: 48 },
  INSTALLATION: { responseHours: 24, closeHours: 168 },
  INSURANCE: { responseHours: 24, closeHours: 240 },
  MOBILE_APP: { responseHours: 8, closeHours: 72 },
  SCHEME: { responseHours: 48, closeHours: 360 },
};
