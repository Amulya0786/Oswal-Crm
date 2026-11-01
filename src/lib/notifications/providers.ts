export type Channel = "whatsapp" | "sms" | "email";

export type OutboundMessage = {
  to: string;
  body: string;
  subject?: string;
};

export type SendResult = {
  ok: boolean;
  id?: string;
  error?: string;
  detail?: string;
};

export interface NotificationProvider {
  name: string;
  channel: Channel;
  isConfigured(): boolean;
  payload(message: OutboundMessage): unknown;
  send(message: OutboundMessage): Promise<SendResult>;
}

export class ConsoleProvider implements NotificationProvider {
  name = "console";
  constructor(public channel: Channel) {}

  isConfigured() {
    return true;
  }

  payload(message: OutboundMessage) {
    return { channel: this.channel, ...message };
  }

  async send(message: OutboundMessage): Promise<SendResult> {
    const subject = message.subject ? ` subject="${message.subject}"` : "";
    console.log(`[notify:${this.channel}] to=${message.to}${subject} ${message.body}`);
    return { ok: true, id: "console" };
  }
}

function dryRun() {
  return process.env.NOTIFY_DRY_RUN === "1" || process.env.NODE_ENV === "test";
}

export class WhatsAppCloudProvider implements NotificationProvider {
  name = "whatsapp-cloud";
  channel: Channel = "whatsapp";

  isConfigured() {
    return Boolean(process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_CLOUD_PHONE_ID);
  }

  payload(message: OutboundMessage) {
    return {
      messaging_product: "whatsapp",
      to: message.to,
      type: "text",
      text: { body: message.body },
    };
  }

  async send(message: OutboundMessage): Promise<SendResult> {
    if (!this.isConfigured()) return { ok: false, error: "not_configured" };
    const payload = this.payload(message);
    if (dryRun()) return { ok: true, id: "dry-run", detail: JSON.stringify(payload) };
    const phoneId = process.env.WHATSAPP_CLOUD_PHONE_ID;
    const response = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_CLOUD_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    if (!response.ok) return { ok: false, error: "provider_error", detail: text.slice(0, 500) };
    return { ok: true, id: "whatsapp-cloud", detail: text.slice(0, 500) };
  }
}

export class GupshupProvider implements NotificationProvider {
  name = "gupshup";
  channel: Channel = "whatsapp";

  isConfigured() {
    return Boolean(process.env.GUPSHUP_API_KEY && process.env.GUPSHUP_SRC_NAME);
  }

  payload(message: OutboundMessage) {
    return {
      channel: "whatsapp",
      source: process.env.GUPSHUP_SOURCE ?? process.env.GUPSHUP_SRC_NAME,
      destination: message.to,
      message: message.body,
      "src.name": process.env.GUPSHUP_SRC_NAME,
    };
  }

  async send(message: OutboundMessage): Promise<SendResult> {
    if (!this.isConfigured()) return { ok: false, error: "not_configured" };
    const payload = this.payload(message);
    if (dryRun()) return { ok: true, id: "dry-run", detail: JSON.stringify(payload) };
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(payload)) body.set(key, String(value ?? ""));
    const response = await fetch("https://api.gupshup.io/wa/api/v1/msg", {
      method: "POST",
      headers: { apikey: process.env.GUPSHUP_API_KEY ?? "", "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const text = await response.text();
    if (!response.ok) return { ok: false, error: "provider_error", detail: text.slice(0, 500) };
    return { ok: true, id: "gupshup", detail: text.slice(0, 500) };
  }
}

export class Msg91Provider implements NotificationProvider {
  name = "msg91";
  channel: Channel = "sms";

  isConfigured() {
    return Boolean(process.env.MSG91_AUTH_KEY && process.env.MSG91_SENDER_ID);
  }

  payload(message: OutboundMessage) {
    return {
      sender: process.env.MSG91_SENDER_ID,
      route: "4",
      country: "91",
      sms: [{ message: message.body, to: [message.to] }],
      template_id: process.env.MSG91_TEMPLATE_ID ?? undefined,
    };
  }

  async send(message: OutboundMessage): Promise<SendResult> {
    if (!this.isConfigured()) return { ok: false, error: "not_configured" };
    const payload = this.payload(message);
    if (dryRun()) return { ok: true, id: "dry-run", detail: JSON.stringify(payload) };
    const response = await fetch("https://control.msg91.com/api/v2/sendsms", {
      method: "POST",
      headers: { authkey: process.env.MSG91_AUTH_KEY ?? "", "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    if (!response.ok) return { ok: false, error: "provider_error", detail: text.slice(0, 500) };
    return { ok: true, id: "msg91", detail: text.slice(0, 500) };
  }
}

export class SmtpStubProvider implements NotificationProvider {
  name = "smtp-stub";
  channel: Channel = "email";

  isConfigured() {
    return Boolean(process.env.SMTP_URL);
  }

  payload(message: OutboundMessage) {
    return { smtp: process.env.SMTP_URL, to: message.to, subject: message.subject, body: message.body };
  }

  async send(message: OutboundMessage): Promise<SendResult> {
    if (!this.isConfigured()) return { ok: false, error: "not_configured" };
    console.log(`[smtp-stub] to=${message.to} subject="${message.subject ?? ""}" ${message.body}`);
    return { ok: true, id: "smtp-stub", detail: "SMTP adapter is a stub in Phase 1. Wire a mailer here in a later phase." };
  }
}

const whatsappCloud = new WhatsAppCloudProvider();
const gupshup = new GupshupProvider();
const msg91 = new Msg91Provider();
const smtp = new SmtpStubProvider();

export function providerFor(channel: Channel): NotificationProvider {
  if (channel === "whatsapp") {
    if (whatsappCloud.isConfigured()) return whatsappCloud;
    if (gupshup.isConfigured()) return gupshup;
  }
  if (channel === "sms" && msg91.isConfigured()) return msg91;
  if (channel === "email" && smtp.isConfigured()) return smtp;
  return new ConsoleProvider(channel);
}

export const providerStubs = { whatsappCloud, gupshup, msg91, smtp };
