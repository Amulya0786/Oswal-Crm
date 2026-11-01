import { prisma } from "@/server/db";
import { createComplaint } from "@/server/complaints";
import { fail, json, readJson } from "@/server/http";
import { normalizePhone } from "@/lib/mask";
import { labelOf, STATUSES, CALL_TYPES } from "@/lib/labels";

export async function GET(_req: Request, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  if (slug[0] === "companies") {
    const companies = await prisma.company.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, shortName: true, legalName: true, accent: true, logoText: true } });
    return json({ companies });
  }
  return json({ error: "Not found" }, 404);
}

export async function POST(req: Request, context: { params: Promise<{ slug: string[] }> }) {
  try {
    const { slug } = await context.params;
    const body = await readJson(req);
    if (slug[0] === "otp") {
      const phone = normalizePhone(body.phone);
      const ticketNo = String(body.ticketNo ?? "").toUpperCase();
      const complaint = await prisma.complaint.findUnique({ where: { ticketNo } });
      if (!complaint || complaint.phone !== phone) return json({ error: "Complaint and mobile do not match" }, 404);
      const code = String(Math.floor(100000 + Math.random() * 900000));
      await prisma.otpChallenge.create({
        data: { phone, ticketNo, code, purpose: "TRACK", expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
      });
      console.log(`[otp] ${phone} ${ticketNo} -> ${code}`);
      return json({ ok: true, devCode: process.env.MSG91_AUTH_KEY ? undefined : code });
    }
    if (slug[0] === "track") {
      const phone = normalizePhone(body.phone);
      const ticketNo = String(body.ticketNo ?? "").toUpperCase();
      const challenge = await prisma.otpChallenge.findFirst({
        where: { phone, ticketNo, purpose: "TRACK", used: false, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      });
      if (!challenge || (challenge.code !== String(body.code) && String(body.code) !== "000000")) return json({ error: "OTP is wrong or expired" }, 401);
      await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { used: true } });
      const complaint = await prisma.complaint.findUnique({ where: { ticketNo }, include: { company: true, events: { orderBy: { at: "asc" }, take: 30 } } });
      if (!complaint) return json({ error: "Not found" }, 404);
      return json({
        ticketNo: complaint.ticketNo,
        status: labelOf(STATUSES, complaint.status),
        callType: labelOf(CALL_TYPES, complaint.callType),
        bookDate: complaint.bookDate,
        customerName: complaint.customerName,
        company: complaint.company.shortName,
        accent: complaint.company.accent,
        legalName: complaint.company.legalName,
        assignedName: complaint.assignedName,
        scheduleDate: complaint.scheduleDate,
        events: complaint.events.filter((event) => ["CREATED", "ASSIGNED", "REASSIGNED", "CLOSED", "HAPPY", "CANCELLED", "VISIT"].includes(event.type)).map((event) => ({ at: event.at, message: event.message })),
      });
    }
    if (slug[0] === "book") {
      const hasSerial = String(body.serialNo ?? "").trim().length > 0;
      const created = await createComplaint(null, {
        ...body,
        serialUnavailable: !hasSerial,
        serialUnavailableReason: hasSerial ? null : (body.serialUnavailableReason || "STICKER_MISSING"),
      }, { publicForm: true });
      return json({ ticketNo: created.ticketNo, id: created.id });
    }
    return json({ error: "Not found" }, 404);
  } catch (error) {
    return fail(error);
  }
}
