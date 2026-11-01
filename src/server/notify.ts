import { createHmac } from "crypto";
import { prisma } from "./db";

type Outbound = {
  channel: "WHATSAPP" | "SMS" | "EMAIL";
  to: string;
  subject?: string | null;
  body: string;
  companyId?: string | null;
  complaintId?: string | null;
  event?: string;
};

const DEFAULT_BODY: Record<string, string> = {
  BOOKING: "{{companyName}}: complaint {{ticketNo}} is booked for {{customerName}}. Track: {{link}}",
  ASSIGNMENT: "{{companyName}}: {{ticketNo}} is assigned to {{engineer}}. We will visit {{scheduleDate}}.",
  VISIT: "{{companyName}}: a visit for {{ticketNo}} is scheduled on {{scheduleDate}}.",
  CLOSING: "{{companyName}}: complaint {{ticketNo}} is closed. {{link}}",
  FEEDBACK: "{{companyName}}: please rate the service for {{ticketNo}} (1-5). {{link}}",
};

export function renderTemplate(body: string, vars: Record<string, string>) {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

async function whatsappCloud(msg: Outbound) {
  const response = await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: msg.to, type: "text", text: { body: msg.body } }),
    signal: AbortSignal.timeout(4000),
  });
  return { provider: "whatsapp-cloud", status: response.ok ? "SENT" : "FAILED", detail: (await response.text()).slice(0, 500) };
}

async function gupshup(msg: Outbound) {
  const body = new URLSearchParams({
    channel: "whatsapp",
    source: process.env.GUPSHUP_SOURCE ?? "",
    destination: msg.to,
    "src.name": process.env.GUPSHUP_SRC_NAME ?? "",
    message: JSON.stringify({ type: "text", text: msg.body }),
  });
  const response = await fetch("https://api.gupshup.io/wa/api/v1/msg", {
    method: "POST",
    headers: { apikey: process.env.GUPSHUP_API_KEY ?? "", "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(4000),
  });
  return { provider: "gupshup", status: response.ok ? "SENT" : "FAILED", detail: (await response.text()).slice(0, 500) };
}

async function msg91(msg: Outbound) {
  const response = await fetch("https://control.msg91.com/api/v5/flow/", {
    method: "POST",
    headers: { authkey: process.env.MSG91_AUTH_KEY ?? "", "Content-Type": "application/json" },
    body: JSON.stringify({ sender: process.env.MSG91_SENDER, mobiles: msg.to, message: msg.body }),
    signal: AbortSignal.timeout(4000),
  });
  return { provider: "msg91", status: response.ok ? "SENT" : "FAILED", detail: (await response.text()).slice(0, 500) };
}

export async function deliver(msg: Outbound) {
  try {
    if (msg.channel === "WHATSAPP" && process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID) return await whatsappCloud(msg);
    if (msg.channel === "WHATSAPP" && process.env.GUPSHUP_API_KEY && process.env.GUPSHUP_SOURCE) return await gupshup(msg);
    if (msg.channel === "SMS" && process.env.MSG91_AUTH_KEY) return await msg91(msg);
  } catch (error) {
    return { provider: "external", status: "FAILED", detail: error instanceof Error ? error.message : "send failed" };
  }
  if (msg.channel === "EMAIL") {
    const origin = process.env.APP_URL ?? "http://localhost:3000";
    const safe = msg.body.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char] ?? char));
    const html = `<div style="font-family:Inter,Arial,sans-serif;color:#242424"><div style="background:#02502f;padding:16px 20px"><img src="${origin}/brand/pumps-logo.png" alt="Oswal" height="64" /></div><div style="padding:16px 20px"><h1 style="font-size:18px">${msg.subject ?? "Oswal"}</h1><p style="white-space:pre-wrap">${safe}</p></div></div>`;
    console.log(`[notify:EMAIL] -> ${msg.to} | ${html}`);
    return { provider: "console", status: "LOGGED", detail: "branded email header" };
  }
  console.log(`[notify:${msg.channel}] -> ${msg.to} | ${msg.body}`);
  return { provider: "console", status: "LOGGED", detail: undefined as string | undefined };
}

export async function notifyComplaint(input: {
  event: string;
  companyId: string;
  companyName: string;
  complaintId: string;
  ticketNo: string;
  customerName: string;
  phone: string;
  email?: string | null;
  engineer?: string | null;
  scheduleDate?: string | null;
  status?: string;
}) {
  try {
    const templates = await prisma.notificationTemplate.findMany({
      where: { companyId: input.companyId, event: input.event, active: true },
    });
    const channels = templates.length
      ? templates
      : (["WHATSAPP", "SMS", "EMAIL"] as const).map((channel) => ({
          channel,
          subject: input.event,
          body: DEFAULT_BODY[input.event] ?? DEFAULT_BODY.BOOKING,
        }));
    const link = `${process.env.APP_URL ?? "http://localhost:3000"}/track?ticket=${input.ticketNo}`;
    const vars = {
      companyName: input.companyName,
      ticketNo: input.ticketNo,
      customerName: input.customerName,
      engineer: input.engineer ?? "our technician",
      scheduleDate: input.scheduleDate ?? "soon",
      status: input.status ?? "",
      link,
      phone: input.phone,
    };
    const logs = [];
    for (const template of channels) {
      const channel = template.channel as Outbound["channel"];
      const to = channel === "EMAIL" ? input.email : input.phone;
      if (!to) continue;
      const body = renderTemplate(template.body, vars);
      const result = await deliver({
        channel,
        to,
        subject: template.subject,
        body,
        companyId: input.companyId,
        complaintId: input.complaintId,
        event: input.event,
      });
      logs.push({
        companyId: input.companyId,
        complaintId: input.complaintId,
        channel,
        recipient: to,
        event: input.event,
        body,
        provider: result.provider,
        status: result.status,
        detail: result.detail,
      });
    }
    if (logs.length) await prisma.notificationLog.createMany({ data: logs });
  } catch (error) {
    console.error("notification failed", error);
  }
}

export async function queueWebhook(event: string, data: unknown, companyId?: string | null) {
  setImmediate(() => {
    void deliverWebhooks(event, data, companyId).catch((error) => console.error(error));
  });
}

async function deliverWebhooks(event: string, data: unknown, companyId?: string | null) {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { active: true, OR: [{ companyId: null }, { companyId: companyId ?? undefined }] },
    take: 20,
  });
  const payload = JSON.stringify({ id: crypto.randomUUID(), type: event, createdAt: new Date().toISOString(), data });
  for (const endpoint of endpoints) {
    const events = endpoint.events.split(",").map((item) => item.trim());
    if (events.length && !events.includes("*") && !events.includes(event)) continue;
    let status = "FAILED";
    let responseText = "";
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (endpoint.secret) headers["X-Oswal-Signature"] = `sha256=${createHmac("sha256", endpoint.secret).update(payload).digest("hex")}`;
      const response = await fetch(endpoint.url, { method: "POST", headers, body: payload, signal: AbortSignal.timeout(4000) });
      status = response.ok ? "SENT" : "FAILED";
      responseText = (await response.text()).slice(0, 500);
    } catch (error) {
      responseText = error instanceof Error ? error.message : "delivery failed";
    }
    await prisma.webhookDelivery.create({
      data: { endpointId: endpoint.id, event, payload, status, response: responseText },
    });
  }
}
