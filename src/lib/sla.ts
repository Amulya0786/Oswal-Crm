import { ACTIVE_STATUSES } from "./labels";

const active = new Set<string>(ACTIVE_STATUSES);

export type SlaInput = {
  status: string;
  bookDate: Date;
  slaDueAt: Date | null;
  now: Date;
  engineerOpen: number;
  historicalHours: number | null;
};

export function assessSla(input: SlaInput): { breached: boolean; risk: boolean; reason: string | null } {
  if (!active.has(input.status) || !input.slaDueAt) return { breached: false, risk: false, reason: null };
  const total = input.slaDueAt.getTime() - input.bookDate.getTime();
  const elapsed = input.now.getTime() - input.bookDate.getTime();
  if (total <= 0) return { breached: false, risk: false, reason: null };
  if (elapsed >= total) return { breached: true, risk: false, reason: "SLA window has passed" };
  const ratio = elapsed / total;
  if (ratio >= 0.75) {
    return { breached: false, risk: true, reason: "More than 75% of the SLA window has elapsed" };
  }
  if (input.engineerOpen >= 10 && ratio >= 0.5) {
    return { breached: false, risk: true, reason: "Technician load is high and the ticket is halfway through its SLA" };
  }
  if (input.historicalHours != null && input.historicalHours > 0 && ratio >= 0.3) {
    const remainingH = (total - elapsed) / 36e5;
    if (input.historicalHours >= remainingH) {
      return { breached: false, risk: true, reason: "Similar complaints usually take longer than the time left" };
    }
  }
  return { breached: false, risk: false, reason: null };
}
