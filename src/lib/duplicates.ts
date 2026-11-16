import { ACTIVE_STATUSES } from "./labels";
import { kolkataYmd } from "./time";
import { normaliseSerial } from "./quality";

export type ExistingTicket = {
  id: string;
  ticketNo: string;
  status: string;
  bookDate: Date;
  closedAt: Date | null;
  cancelledAt: Date | null;
  companyId: string;
  phone: string;
  serialNo: string | null;
  customerId: string | null;
  customerName: string;
};

const active = new Set<string>(ACTIVE_STATUSES);

export function classifyDuplicates(
  rows: ExistingTicket[],
  input: { phone: string; serialNo?: string | null; customerId?: string | null; companyId: string },
  now = new Date(),
) {
  const recentCutoff = now.getTime() - 30 * 86400000;
  const sameIdentity = (row: ExistingTicket) => {
    if (row.phone === input.phone) return true;
    if (input.serialNo && row.serialNo && row.serialNo === input.serialNo) return true;
    if (input.customerId && row.customerId && row.customerId === input.customerId) return true;
    return false;
  };
  const matched = rows.filter(sameIdentity);
  const open = matched.filter((row) => active.has(row.status));
  const recent = matched.filter((row) => {
    if (active.has(row.status)) return false;
    const stamp = row.closedAt ?? row.cancelledAt ?? row.bookDate;
    return stamp.getTime() >= recentCutoff;
  });
  const repeatProduct = Boolean(input.serialNo && matched.some((row) => row.serialNo === input.serialNo));
  let reason: string | null = null;
  if (open.length) {
    reason = `Open complaint ${open[0].ticketNo} already exists for this customer.`;
  } else if (recent.length) {
    reason = `${recent[0].ticketNo} was closed in the last 30 days.`;
  }
  if (repeatProduct) {
    reason = reason ? `${reason} This serial has failed before.` : "This serial number has an earlier complaint.";
  }
  return { open, recent, repeatProduct, reason };
}

export type BookingRow = ExistingTicket & {
  productId?: string | null;
  districtId?: string | null;
  capacityLabel?: string | null;
  productDetails?: string | null;
  serialNorm?: string | null;
};

function sameIstDay(a: Date, b: Date) {
  const left = kolkataYmd(a);
  const right = kolkataYmd(b);
  return left.y === right.y && left.m === right.m && left.d === right.d;
}

function sameCustomer(left: string, right: string) {
  return left.trim().toLowerCase().replace(/\s+/g, " ") === right.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Open serial match, or when there is no serial: mobile + customer + product/capacity + district. Same-day copies are a separate warning. */
export function bookingConflicts(
  rows: BookingRow[],
  input: {
    phone: string;
    serialNo?: string | null;
    customerName: string;
    productId?: string | null;
    productDetails?: string | null;
    capacityLabel?: string | null;
    districtId?: string | null;
    companyId: string;
  },
  now = new Date(),
) {
  const serial = input.serialNo ? normaliseSerial(input.serialNo) : "";
  const matches = rows.flatMap((row) => {
    if (row.companyId !== input.companyId) return [];
    let basis: string | null = null;
    const rowSerial = normaliseSerial(row.serialNorm || row.serialNo);
    if (serial && rowSerial && rowSerial === serial) basis = "same serial";
    if (!serial) {
      const product = Boolean(input.productId && row.productId && row.productId === input.productId);
      const capacity = Boolean(input.capacityLabel && row.capacityLabel && row.capacityLabel === input.capacityLabel);
      const sameText = Boolean(input.productDetails && row.productDetails && row.productDetails.trim().toLowerCase() === input.productDetails.trim().toLowerCase());
      if (row.phone === input.phone && sameCustomer(row.customerName, input.customerName) && (product || capacity || sameText) && row.districtId === input.districtId) {
        basis = "same mobile, customer, product and district";
      }
    }
    if (!basis) return [];
    return [{ ticketNo: row.ticketNo, status: row.status, basis, open: active.has(row.status), sameDay: sameIstDay(new Date(row.bookDate), now) }];
  });
  const blocking = matches.filter((row) => row.open);
  const sameDay = matches.filter((row) => row.sameDay);
  const lead = blocking[0] ?? sameDay[0] ?? null;
  let reason: string | null = null;
  if (blocking[0]) reason = `Open ticket ${blocking[0].ticketNo} already matches (${blocking[0].basis}).`;
  else if (sameDay[0]) reason = `Same-day duplicate of ${sameDay[0].ticketNo} (${sameDay[0].basis}).`;
  return { blocking, sameDay, reason, lead };
}
