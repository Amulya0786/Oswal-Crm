import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "./db";
import { normalizePhone } from "@/lib/mask";
import { allowSend, classifyInbound, renderWhatsApp, statusReply, type Lang, type WhatsAppEvent } from "@/lib/phase2";
import { parseRating, ratingNeedsEscalation } from "@/lib/phase3";
import { labelOf, STATUSES } from "@/lib/labels";
import { runChat } from "./chat";

export function whatsAppMode(): "meta" | "bsp" | "log" {
  if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID) return "meta";
  if (process.env.WHATSAPP_BSP_URL && process.env.WHATSAPP_BSP_KEY) return "bsp";
  if (process.env.GUPSHUP_API_KEY && process.env.GUPSHUP_SOURCE) return "bsp";
  return "log";
}

async function postMeta(to: string, body: string, template: string) {
  const named = process.env[`WHATSAPP_TEMPLATE_${template.toUpperCase()}`];
  const payload = named
    ? { messaging_product: "whatsapp", to, type: "template", template: { name: named, language: { code: "en" } } }
    : { messaging_product: "whatsapp", to, type: "text", text: { body } };
  const response = await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(4000),
  });
  return { provider: "meta", status: response.ok ? "SENT" : "FAILED", detail: (await response.text()).slice(0, 400) };
}

async function postBsp(to: string, body: string) {
  if (process.env.WHATSAPP_BSP_URL && process.env.WHATSAPP_BSP_KEY) {
    const response = await fetch(process.env.WHATSAPP_BSP_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_BSP_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to, type: "text", text: body, channel: "whatsapp" }),
      signal: AbortSignal.timeout(4000),
    });
    return { provider: process.env.WHATSAPP_BSP_NAME || "bsp", status: response.ok ? "SENT" : "FAILED", detail: (await response.text()).slice(0, 400) };
  }
  const form = new URLSearchParams({
    channel: "whatsapp",
    source: process.env.GUPSHUP_SOURCE ?? "",
    destination: to,
    "src.name": process.env.GUPSHUP_SRC_NAME ?? "",
    message: JSON.stringify({ type: "text", text: body }),
  });
  const response = await fetch("https://api.gupshup.io/wa/api/v1/msg", {
    method: "POST",
    headers: { apikey: process.env.GUPSHUP_API_KEY ?? "", "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    signal: AbortSignal.timeout(4000),
  });
  return { provider: "gupshup", status: response.ok ? "SENT" : "FAILED", detail: (await response.text()).slice(0, 400) };
}

export async function sendWhatsApp(input: {
  event: WhatsAppEvent | "STATUS" | "SUMMARY";
  to: string;
  body: string;
  template?: string;
  companyId?: string | null;
  complaintId?: string | null;
  lang?: Lang;
}) {
  const phone = normalizePhone(input.to);
  if (phone.length < 10) return { status: "SKIPPED", detail: "bad phone" };
  const opted = await prisma.whatsAppOptOut.findUnique({ where: { phoneNorm: phone } });
  if (opted && input.event !== "STATUS") return { status: "SKIPPED", detail: "opt-out" };
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.notificationLog.count({ where: { channel: "WHATSAPP", recipient: phone, at: { gte: since } } });
  if (!allowSend(recent)) return { status: "SKIPPED", detail: "rate limit" };
  const mode = whatsAppMode();
  let result = { provider: "log", status: "LOGGED", detail: "no provider keys" };
  try {
    if (mode === "meta") result = await postMeta(phone, input.body, input.template ?? input.event);
    else if (mode === "bsp") result = await postBsp(phone, input.body);
    else console.log(`[whatsapp:${input.event}] -> ${phone} | ${input.body}`);
  } catch (error) {
    result = { provider: mode, status: "FAILED", detail: error instanceof Error ? error.message : "send failed" };
  }
  await prisma.notificationLog.create({
    data: {
      channel: "WHATSAPP",
      recipient: phone,
      event: input.event,
      body: input.body,
      provider: result.provider,
      status: result.status,
      detail: result.detail,
      companyId: input.companyId,
      complaintId: input.complaintId,
    },
  });
  if (input.complaintId) {
    await prisma.complaintEvent.create({
      data: {
        complaintId: input.complaintId,
        type: "WHATSAPP",
        actorName: "WhatsApp",
        message: `${input.event} · ${result.status}${input.lang ? ` · ${input.lang}` : ""}`,
      },
    });
  }
  return result;
}

export async function notifyWhatsAppEvent(event: WhatsAppEvent, input: {
  phone: string;
  companyId?: string | null;
  complaintId?: string | null;
  lang?: Lang;
  vars: Record<string, string>;
}) {
  const lang = input.lang ?? "en";
  const saved = input.companyId
    ? await prisma.notificationTemplate.findFirst({ where: { companyId: input.companyId, event: `WA_${event}_${lang.toUpperCase()}`, channel: "WHATSAPP", active: true } })
    : null;
  const rendered = renderWhatsApp(event, lang, input.vars);
  const body = saved ? saved.body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => input.vars[key] ?? "") : rendered.body;
  return sendWhatsApp({ event, to: input.phone, body, template: rendered.template, companyId: input.companyId, complaintId: input.complaintId, lang });
}

export function whatsAppPostAllowed(raw: string, signature: string | null, shared: string | null) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (appSecret) {
    const expected = `sha256=${createHmac("sha256", appSecret).update(raw).digest("hex")}`;
    const left = Buffer.from(signature ?? "");
    const right = Buffer.from(expected);
    return left.length === right.length && timingSafeEqual(left, right);
  }
  const token = process.env.WHATSAPP_WEBHOOK_SECRET || process.env.WHATSAPP_VERIFY_TOKEN;
  if (token) return shared === token;
  return process.env.NODE_ENV !== "production";
}

export async function handleWhatsAppWebhook(payload: unknown) {
  const message = extractInbound(payload);
  if (!message) return { ok: true, ignored: true };
  const phone = normalizePhone(message.from);
  const rating = parseRating(message.text);
  if (rating) {
    const openFeedback = await prisma.complaint.findFirst({
      where: { phone, feedbackPending: true },
      orderBy: { closedAt: "desc" },
    });
    if (openFeedback) {
      await prisma.complaint.update({
        where: { id: openFeedback.id },
        data: {
          happyRating: rating.rating,
          happyRemarks: rating.comment || openFeedback.happyRemarks,
          happyAt: new Date(),
          feedbackPending: false,
          status: openFeedback.status === "CLOSED" ? "HAPPY_CALLING" : openFeedback.status,
          finalStatus: "Happy Calling Done",
        },
      });
      await prisma.complaintEvent.create({
        data: { complaintId: openFeedback.id, type: "HAPPY", actorName: "WhatsApp", message: `Feedback ${rating.rating}/5${rating.comment ? ` · ${rating.comment}` : ""}` },
      });
      if (ratingNeedsEscalation(rating.rating)) {
        const manager = await prisma.user.findFirst({ where: { role: { in: ["AREA_MANAGER", "STATE_HEAD", "ADMIN"] }, active: true }, orderBy: { role: "asc" } });
        await prisma.escalationLog.create({
          data: { complaintId: openFeedback.id, fromLevel: openFeedback.escalationLevel, toLevel: openFeedback.escalationLevel + 1, toUserId: manager?.id, toName: manager?.name ?? "Service manager", message: `Low feedback ${rating.rating}/5 on ${openFeedback.ticketNo}` },
        });
        await prisma.complaint.update({ where: { id: openFeedback.id }, data: { escalationLevel: { increment: 1 }, escalatedToId: manager?.id, escalatedAt: new Date() } });
      }
      return { ok: true, rating: rating.rating, ticketNo: openFeedback.ticketNo };
    }
  }
  const kind = classifyInbound(message.text);
  if (kind.kind === "optout") {
    await prisma.whatsAppOptOut.upsert({ where: { phoneNorm: phone }, create: { phoneNorm: phone, source: "whatsapp" }, update: { at: new Date() } });
    return { ok: true, optout: true };
  }
  if (kind.kind === "optin") {
    await prisma.whatsAppOptOut.deleteMany({ where: { phoneNorm: phone } });
    return { ok: true, optin: true };
  }
  if (kind.kind !== "ticket" && kind.kind !== "phone") {
    const chat = await runChat(phone, message.text);
    for (const line of chat.messages) await sendWhatsApp({ event: "STATUS", to: phone, body: line });
    return { ok: true, chat: chat.action };
  }
  const complaint = kind.kind === "ticket"
    ? await prisma.complaint.findUnique({ where: { ticketNo: kind.ticketNo } })
    : await prisma.complaint.findFirst({ where: { phone: kind.kind === "phone" ? kind.phone : phone }, orderBy: { bookDate: "desc" } });
  if (!complaint) {
    const chat = await runChat(phone, message.text);
    for (const line of chat.messages) await sendWhatsApp({ event: "STATUS", to: phone, body: line });
    return { ok: true, found: false, chat: chat.action };
  }
  const body = statusReply("en", { ticketNo: complaint.ticketNo, status: labelOf(STATUSES, complaint.status), engineer: complaint.assignedName });
  await sendWhatsApp({ event: "STATUS", to: phone, body, complaintId: complaint.id, companyId: complaint.companyId });
  return { ok: true, ticketNo: complaint.ticketNo };
}

function extractInbound(payload: unknown): { from: string; text: string } | null {
  const body = payload as {
    from?: string;
    text?: string;
    entry?: { changes?: { value?: { messages?: { from?: string; text?: { body?: string } }[] } }[] }[];
  };
  const meta = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (meta?.from && meta.text?.body) return { from: meta.from, text: meta.text.body };
  if (body.from && body.text) return { from: body.from, text: body.text };
  return null;
}
