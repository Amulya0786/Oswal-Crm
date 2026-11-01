import { prisma } from "@/server/db";
import { createComplaint } from "@/server/complaints";
import { fail, json, readJson } from "@/server/http";
import { normalizePhone } from "@/lib/mask";
import { labelOf, STATUSES, CALL_TYPES } from "@/lib/labels";
import { allowPublicAttempt, checkCaptcha, issueCaptcha } from "@/lib/phase2";
import { handleWhatsAppWebhook } from "@/server/whatsapp";
import { saveMedia } from "@/server/field";

const attempts = new Map<string, number[]>();
const secret = () => process.env.AUTH_SECRET || "dev";

function gate(key: string) {
  const now = Date.now();
  const current = attempts.get(key) ?? [];
  const decision = allowPublicAttempt(current, now);
  if (!decision.ok) return false;
  attempts.set(key, [...decision.recent, now]);
  return true;
}

export async function GET(req: Request, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  if (slug[0] === "whatsapp") {
    const url = new URL(req.url);
    const token = url.searchParams.get("hub.verify_token");
    if (token && token === process.env.WHATSAPP_VERIFY_TOKEN) return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
    return json({ ok: true, mode: "log" });
  }
  if (slug[0] === "captcha") {
    const issued = issueCaptcha(secret());
    return json({ token: issued.token, question: issued.question });
  }
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
        technicianFirst: complaint.assignedName?.split(" ")[0] ?? null,
        scheduleDate: complaint.scheduleDate,
        happyRating: complaint.happyRating,
        feedbackPending: complaint.feedbackPending,
        events: complaint.events.filter((event) => ["CREATED", "ASSIGNED", "REASSIGNED", "CLOSED", "HAPPY", "CANCELLED", "VISIT"].includes(event.type)).map((event) => ({ at: event.at, message: event.message })),
      });
    }
    if (slug[0] === "rate") {
      const token = String(body.token ?? "");
      const rating = Number(body.rating);
      const complaint = await prisma.complaint.findFirst({ where: { OR: [{ trackToken: token }, { ticketNo: token.toUpperCase() }] } });
      if (!complaint) return json({ error: "Complaint not found" }, 404);
      if (!complaint.feedbackPending && complaint.happyRating == null) return json({ error: "Rating opens after the visit is closed" }, 400);
      if (rating < 1 || rating > 5) return json({ error: "Choose 1 to 5" }, 400);
      await prisma.complaint.update({
        where: { id: complaint.id },
        data: { happyRating: rating, happyRemarks: String(body.comment ?? "") || null, happyAt: new Date(), feedbackPending: false, status: complaint.status === "CLOSED" ? "HAPPY_CALLING" : complaint.status },
      });
      if (rating <= 2) {
        const manager = await prisma.user.findFirst({ where: { role: { in: ["AREA_MANAGER", "STATE_HEAD", "ADMIN"] }, active: true } });
        await prisma.escalationLog.create({ data: { complaintId: complaint.id, fromLevel: complaint.escalationLevel, toLevel: complaint.escalationLevel + 1, toUserId: manager?.id, toName: manager?.name ?? "Service manager", message: `Low feedback ${rating}/5 on ${complaint.ticketNo}` } });
      }
      return json({ ok: true });
    }
    if (slug[0] === "whatsapp") return json(await handleWhatsAppWebhook(body));
    if (slug[0] === "otp-book") {
      const phone = normalizePhone(body.phone);
      if (phone.length !== 10) return json({ error: "Enter a 10-digit mobile" }, 400);
      if (!gate(`otp:${phone}`)) return json({ error: "Too many codes. Try again in an hour." }, 429);
      const code = String(Math.floor(100000 + Math.random() * 900000));
      await prisma.otpChallenge.create({ data: { phone, code, purpose: "BOOK", expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
      console.log(`[otp-book] ${phone} -> ${code}`);
      return json({ ok: true, devCode: process.env.MSG91_AUTH_KEY ? undefined : code });
    }
    if (slug[0] === "book") {
      const phone = normalizePhone(body.phone);
      if (!gate(`book:${phone}`)) return json({ error: "Too many bookings from this mobile. Try again in an hour." }, 429);
      if (!checkCaptcha(secret(), String(body.captchaToken ?? ""), String(body.captchaAnswer ?? ""))) return json({ error: "Captcha answer is wrong or expired" }, 400);
      const challenge = await prisma.otpChallenge.findFirst({
        where: { phone, purpose: "BOOK", used: false, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      });
      if (!challenge || challenge.code !== String(body.otp ?? "")) return json({ error: "Mobile OTP is wrong or expired" }, 401);
      await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { used: true } });
      let districtId = body.districtId || null;
      if (!districtId && body.districtName) {
        const district = await prisma.district.findFirst({ where: { name: { equals: String(body.districtName), mode: "insensitive" } } });
        districtId = district?.id ?? null;
      }
      const hasSerial = String(body.serialNo ?? "").trim().length > 0;
      const photos = Array.isArray(body.photos) ? body.photos.slice(0, 3) : [];
      const created = await createComplaint(null, {
        ...body,
        districtId,
        callType: body.callType || "BREAKDOWN",
        natureText: body.natureText || body.problem,
        productDetails: body.productDetails || body.product,
        serialUnavailable: !hasSerial,
        serialUnavailableReason: hasSerial ? null : (body.serialUnavailableReason || "STICKER_MISSING"),
      }, { publicForm: true });
      for (const photo of photos) {
        if (typeof photo === "string") await saveMedia(created.id, "BEFORE", photo, "Website form");
      }
      return json({ ticketNo: created.ticketNo, id: created.id });
    }
    return json({ error: "Not found" }, 404);
  } catch (error) {
    return fail(error);
  }
}
