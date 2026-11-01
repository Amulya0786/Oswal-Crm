import { ageingBucket, startOfDayIST, startOfMonthIST, type AgeBucket } from "./time";
import { isCloseBreach, isResponseBreach } from "./sla";
import { isOpenWork } from "./workflow";

export type DashRow = {
  status: string;
  type: string;
  createdAt: Date;
  closedAt?: Date | null;
  happyAt?: Date | null;
  cancelledAt?: Date | null;
  firstResponseAt?: Date | null;
  slaResponseDue?: Date | null;
  slaCloseDue?: Date | null;
  districtId?: string | null;
  stateId?: string | null;
};

function atOrAfter(value: Date | null | undefined, boundary: number) {
  return !!value && new Date(value).getTime() >= boundary;
}

export function summarize(rows: DashRow[], now = new Date()) {
  const day = startOfDayIST(now).getTime();
  const month = startOfMonthIST(now).getTime();
  const open = rows.filter((row) => isOpenWork(row.status));
  const bucket = (name: AgeBucket) => open.filter((row) => ageingBucket(new Date(row.createdAt), now) === name).length;
  const closedStatuses = (row: DashRow) => row.status === "CLOSED" || row.status === "HAPPY_CALLING_DONE";

  return {
    totalPending: open.length,
    open: rows.filter((row) => row.status === "OPEN").length,
    assigned: rows.filter((row) => row.status === "ASSIGNED" || row.status === "REASSIGNED").length,
    pending: rows.filter((row) => row.status === "PENDING").length,
    monthLogin: rows.filter((row) => atOrAfter(row.createdAt, month)).length,
    monthClosed: rows.filter((row) => atOrAfter(row.closedAt, month) && closedStatuses(row)).length,
    monthHappy: rows.filter((row) => atOrAfter(row.happyAt, month)).length,
    monthCancelled: rows.filter((row) => atOrAfter(row.cancelledAt, month)).length,
    breakdown: open.filter((row) => row.type === "BREAKDOWN").length,
    installation: open.filter((row) => row.type === "INSTALLATION").length,
    insurance: open.filter((row) => row.type === "INSURANCE").length,
    mobile: open.filter((row) => row.type === "MOBILE_APP").length,
    scheme: open.filter((row) => row.type === "SCHEME").length,
    todayLogin: rows.filter((row) => atOrAfter(row.createdAt, day)).length,
    todayClosed: rows.filter((row) => atOrAfter(row.closedAt, day) && closedStatuses(row)).length,
    todayHappy: rows.filter((row) => atOrAfter(row.happyAt, day)).length,
    todayCancelled: rows.filter((row) => atOrAfter(row.cancelledAt, day)).length,
    age02: bucket("0-2"),
    age37: bucket("3-7"),
    age815: bucket("8-15"),
    age15: bucket("15+"),
    responseBreach: open.filter((row) => isResponseBreach({ ...row, escalationLevel: 0 }, now)).length,
    closeBreach: open.filter((row) => isCloseBreach({ ...row, escalationLevel: 0 }, now)).length,
  };
}

export function countBy<T>(rows: T[], key: (row: T) => string) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const name = key(row) || "Unspecified";
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

export function trend14(rows: { createdAt: Date }[], now = new Date()) {
  const start = startOfDayIST(now);
  const points: { name: string; value: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(start.getTime() - i * 86_400_000);
    const label = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short" }).format(day);
    const value = rows.filter((row) => startOfDayIST(new Date(row.createdAt)).getTime() === day.getTime()).length;
    points.push({ name: label, value });
  }
  return points;
}
