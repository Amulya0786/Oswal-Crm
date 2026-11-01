import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "./db";
import { HttpError } from "./http";
import { updateComplaint } from "./complaints";
import { notifyWhatsAppEvent } from "./whatsapp";
import type { SessionUser } from "@/lib/types";
import { kolkataYmd } from "@/lib/time";

function requireTech(user: SessionUser) {
  if (user.role !== "TECHNICIAN" || !user.engineerId) throw new HttpError(403, "This action is for a technician login");
  return user.engineerId;
}

export async function todayVisits(user: SessionUser) {
  if (!user.engineerId) return [];
  const today = kolkataYmd();
  const start = new Date(Date.UTC(today.y, today.m - 1, today.d, -5, -30));
  const end = new Date(start.getTime() + 86400000);
  return prisma.complaint.findMany({
    where: {
      engineerId: user.engineerId,
      status: { in: ["OPEN", "ASSIGNED", "REASSIGNED", "PENDING"] },
      OR: [{ scheduleDate: null }, { scheduleDate: { gte: start, lt: end } }],
    },
    orderBy: { scheduleDate: "asc" },
    take: 50,
    select: {
      id: true, ticketNo: true, customerName: true, phone: true, address: true, districtName: true, pincode: true,
      status: true, scheduleDate: true, productDetails: true, serialPending: true, lat: true, lng: true, natureText: true,
    },
  });
}

export async function checkIn(user: SessionUser, complaintId: string, kind: "START" | "ARRIVE", lat?: number | null, lng?: number | null) {
  const engineerId = requireTech(user);
  const complaint = await prisma.complaint.findFirst({ where: { id: complaintId, engineerId } });
  if (!complaint) throw new HttpError(404, "That visit is not on your list");
  await prisma.visitCheck.create({ data: { complaintId, engineerId, kind, lat: lat ?? null, lng: lng ?? null } });
  if (lat != null && lng != null) {
    await prisma.techPing.create({ data: { engineerId, lat, lng } });
    await prisma.complaint.update({ where: { id: complaintId }, data: { lat, lng } });
  }
  await prisma.complaintEvent.create({
    data: { complaintId, actorId: user.id, actorName: user.name, type: kind === "ARRIVE" ? "ARRIVED" : "VISIT", message: kind === "ARRIVE" ? "Arrived on site" : "Started travel" },
  });
  return { ok: true };
}

export async function saveMedia(complaintId: string, kind: string, dataUrl: string | null | undefined, note?: string | null) {
  if (!dataUrl) return;
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 1_500_000) throw new HttpError(400, "Photo is larger than 1.5 MB");
  const ext = match[1].includes("png") ? "png" : "jpg";
  const dir = path.join(process.cwd(), "data", "uploads");
  await mkdir(dir, { recursive: true });
  const file = `${complaintId}-${kind}-${Date.now()}.${ext}`;
  await writeFile(path.join(dir, file), bytes);
  await prisma.fieldMedia.create({ data: { complaintId, kind, path: file, note: note ?? null } });
}

export async function issueCloseOtp(user: SessionUser, complaintId: string) {
  const engineerId = requireTech(user);
  const complaint = await prisma.complaint.findFirst({ where: { id: complaintId, engineerId } });
  if (!complaint) throw new HttpError(404, "That visit is not on your list");
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await prisma.otpChallenge.create({
    data: { phone: complaint.phone, ticketNo: complaint.ticketNo, code, purpose: "CLOSE", expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });
  await notifyWhatsAppEvent("CLOSE_OTP", {
    phone: complaint.phone,
    companyId: complaint.companyId,
    complaintId: complaint.id,
    vars: { ticketNo: complaint.ticketNo, otp: code, customerName: complaint.customerName },
  });
  return { ok: true, devCode: whatsAppConfigured() ? undefined : code };
}

function whatsAppConfigured() {
  return Boolean(process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_BSP_KEY || process.env.GUPSHUP_API_KEY);
}

export async function fieldClose(user: SessionUser, complaintId: string, input: {
  otp: string;
  problemText?: string | null;
  solutionText?: string | null;
  serialNo?: string | null;
  nameplate?: string | null;
  before?: string | null;
  after?: string | null;
  signature?: string | null;
  spares?: { partId?: string | null; name?: string | null; qty?: number }[];
}) {
  const engineerId = requireTech(user);
  const complaint = await prisma.complaint.findFirst({ where: { id: complaintId, engineerId } });
  if (!complaint) throw new HttpError(404, "That visit is not on your list");
  const challenge = await prisma.otpChallenge.findFirst({
    where: { phone: complaint.phone, ticketNo: complaint.ticketNo, purpose: "CLOSE", used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge || challenge.code !== String(input.otp)) throw new HttpError(401, "Customer OTP is wrong or expired");
  await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { used: true } });
  if (input.nameplate) await saveMedia(complaintId, "NAMEPLATE", input.nameplate);
  await saveMedia(complaintId, "BEFORE", input.before);
  await saveMedia(complaintId, "AFTER", input.after);
  await saveMedia(complaintId, "SIGNATURE", input.signature, "Customer signature");
  for (const spare of input.spares ?? []) {
    const name = spare.name?.trim();
    if (!name && !spare.partId) continue;
    const part = spare.partId ? await prisma.sparePart.findUnique({ where: { id: spare.partId } }) : null;
    await prisma.spareRequest.create({ data: { complaintId, partName: part?.name || name || "Spare", qty: Math.max(1, Number(spare.qty) || 1), status: "USED" } });
  }
  const closed = await updateComplaint(user, complaint.companyId, complaintId, {
    action: "close",
    problemText: input.problemText,
    solutionText: input.solutionText,
    serialNo: input.serialNo,
    nameplateCaptured: Boolean(input.nameplate),
  });
  const link = `${process.env.APP_URL ?? "http://localhost:3000"}/track?ticket=${complaint.ticketNo}`;
  await notifyWhatsAppEvent("CLOSED_FEEDBACK", {
    phone: complaint.phone,
    companyId: complaint.companyId,
    complaintId,
    vars: { ticketNo: complaint.ticketNo, customerName: complaint.customerName, link },
  });
  return closed;
}

export async function punch(user: SessionUser, kind: "IN" | "OUT", lat?: number | null, lng?: number | null) {
  const engineerId = requireTech(user);
  if (lat != null && lng != null) await prisma.techPing.create({ data: { engineerId, lat, lng } });
  return prisma.attendancePunch.create({ data: { engineerId, kind, lat: lat ?? null, lng: lng ?? null } });
}

export async function earnings(user: SessionUser) {
  if (!user.engineerId) return { visits: 0, rate: Number(process.env.VISIT_RATE ?? 0), amount: 0 };
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const visits = await prisma.complaint.count({ where: { engineerId: user.engineerId, status: { in: ["CLOSED", "HAPPY_CALLING"] }, closedAt: { gte: start } } });
  const rate = Number(process.env.VISIT_RATE ?? 0);
  return { visits, rate, amount: visits * rate };
}
