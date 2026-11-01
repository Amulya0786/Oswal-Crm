import { prisma } from "./db";
import { normalizePhone } from "@/lib/mask";

export type ScreenPop = {
  phone: string;
  ticketNo: string | null;
  complaintId: string | null;
  customerName: string | null;
  status: string | null;
};

/** Provider-agnostic call adapter. No PBX is connected yet; calls are logged locally. */
export interface TelephonyAdapter {
  screenPop(phone: string): Promise<ScreenPop>;
  logCall(input: { phone: string; complaintId?: string | null; direction?: string; note?: string | null }): Promise<void>;
}

class LogTelephony implements TelephonyAdapter {
  async screenPop(phone: string): Promise<ScreenPop> {
    const normalised = normalizePhone(phone);
    const complaint = normalised.length >= 10
      ? await prisma.complaint.findFirst({ where: { phone: normalised }, orderBy: { bookDate: "desc" } })
      : null;
    return {
      phone: normalised,
      ticketNo: complaint?.ticketNo ?? null,
      complaintId: complaint?.id ?? null,
      customerName: complaint?.customerName ?? null,
      status: complaint?.status ?? null,
    };
  }

  async logCall(input: { phone: string; complaintId?: string | null; direction?: string; note?: string | null }) {
    const phone = normalizePhone(input.phone);
    await prisma.callLog.create({
      data: { phone, complaintId: input.complaintId || null, direction: input.direction || "IN", note: input.note || null },
    });
    if (input.complaintId) {
      await prisma.complaintEvent.create({
        data: {
          complaintId: input.complaintId,
          type: "CALL",
          actorName: "Phone",
          message: `${input.direction || "IN"} call ${phone}${input.note ? ` · ${input.note}` : ""}`,
        },
      });
    }
  }
}

export function telephony(): TelephonyAdapter {
  return new LogTelephony();
}
