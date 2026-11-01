import { createHmac, timingSafeEqual } from "crypto";
import { normalizePhone } from "./mask";

export const WHATSAPP_EVENTS = [
  "REGISTERED",
  "ASSIGNED",
  "RESCHEDULED",
  "CLOSE_OTP",
  "CLOSED_FEEDBACK",
  "FEEDBACK",
  "SLA_APOLOGY",
] as const;

export type WhatsAppEvent = (typeof WHATSAPP_EVENTS)[number];
export type Lang = "en" | "hi";

const COPY: Record<WhatsAppEvent, Record<Lang, string>> = {
  REGISTERED: {
    en: "Oswal: complaint {{ticketNo}} is registered for {{customerName}}. Track it: {{link}}",
    hi: "ओसवाल: शिकायत {{ticketNo}} {{customerName}} के नाम दर्ज हो गई है। स्थिति: {{link}}",
  },
  ASSIGNED: {
    en: "Oswal: {{ticketNo}} is assigned to {{engineer}} ({{engineerPhone}}). Expected visit {{scheduleDate}}.",
    hi: "ओसवाल: {{ticketNo}} तकनीशियन {{engineer}} ({{engineerPhone}}) को दिया गया है। अनुमानित विज़िट {{scheduleDate}}।",
  },
  RESCHEDULED: {
    en: "Oswal: the visit for {{ticketNo}} is now {{scheduleDate}}.",
    hi: "ओसवाल: {{ticketNo}} की विज़िट अब {{scheduleDate}} को है।",
  },
  CLOSE_OTP: {
    en: "Oswal: share OTP {{otp}} with the technician to close {{ticketNo}}. Do not share it with anyone else.",
    hi: "ओसवाल: {{ticketNo}} बंद करने के लिए OTP {{otp}} तकनीशियन को बताएं। किसी और को न दें।",
  },
  CLOSED_FEEDBACK: {
    en: "Oswal: {{ticketNo}} is closed. Please rate the visit: {{link}}",
    hi: "ओसवाल: {{ticketNo}} बंद हो गई है। कृपया विज़िट का मूल्यांकन करें: {{link}}",
  },
  FEEDBACK: {
    en: "Oswal: {{ticketNo}} is closed. Reply with 1 to 5, and a comment if you want. Example: 4 Working well. A desk agent can still call you.",
    hi: "ओसवाल: {{ticketNo}} बंद हो गई है। 1 से 5 का उत्तर दें और चाहें तो टिप्पणी लिखें। उदाहरण: 4 अच्छा काम। कॉल सेंटर भी फोन कर सकता है।",
  },
  SLA_APOLOGY: {
    en: "Oswal: sorry, {{ticketNo}} is taking longer than promised. We are chasing it and will update you.",
    hi: "ओसवाल: क्षमा करें, {{ticketNo}} वादा किए समय से अधिक ले रही है। हम इसे जल्दी निपटा रहे हैं।",
  },
};

export function renderWhatsApp(event: WhatsAppEvent, lang: Lang, vars: Record<string, string>) {
  const body = COPY[event][lang].replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
  return { event, lang, template: `oswal_${event.toLowerCase()}_${lang}`, body };
}

const OPT_OUT = new Set(["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "BAND", "बंद", "बन्द"]);

export function classifyInbound(text: string):
  | { kind: "optout" }
  | { kind: "optin" }
  | { kind: "ticket"; ticketNo: string }
  | { kind: "phone"; phone: string }
  | { kind: "ignore" } {
  const raw = text.trim();
  const upper = raw.toUpperCase();
  if (OPT_OUT.has(upper) || OPT_OUT.has(raw) || upper === "STOP ALL") return { kind: "optout" };
  if (upper === "START" || raw === "शुरू") return { kind: "optin" };
  const ticket = raw.toUpperCase().match(/\bOPL\d{6,}\b/);
  if (ticket) return { kind: "ticket", ticketNo: ticket[0] };
  const phone = normalizePhone(raw);
  if (phone.length === 10 && /^\d+$/.test(raw.replace(/\D/g, "")) && raw.replace(/\D/g, "").length >= 10) return { kind: "phone", phone };
  return { kind: "ignore" };
}

export function allowSend(recentCount: number, limit = 5) {
  return recentCount < limit;
}

export function statusReply(lang: Lang, input: { ticketNo: string; status: string; engineer?: string | null }) {
  if (lang === "hi") return `ओसवाल: ${input.ticketNo} की स्थिति ${input.status} है। तकनीशियन: ${input.engineer || "अभी नियुक्त नहीं"}. बंद करने के लिए STOP भेजें।`;
  return `Oswal: ${input.ticketNo} is ${input.status}. Technician: ${input.engineer || "not assigned yet"}. Reply STOP to opt out.`;
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const lat1 = a.lat * rad;
  const lat2 = b.lat * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Extra points for a nearer technician and for a ticket already at SLA risk. Existing skill and area scores stay in place. */
export function geoBonus(distanceKm: number | null, slaRisk: boolean) {
  const reasons: string[] = [];
  let score = 0;
  if (distanceKm != null && Number.isFinite(distanceKm)) {
    score += Math.max(0, 40 - Math.round(distanceKm));
    reasons.push(`${distanceKm.toFixed(1)} km away`);
  }
  if (slaRisk) {
    score += 12;
    reasons.push("SLA at risk");
  }
  return { score, reason: reasons.join(" · ") };
}

export function issueCaptcha(secret: string, now = Date.now()) {
  const left = 2 + (now % 7);
  const right = 1 + (Math.floor(now / 7) % 8);
  const exp = now + 10 * 60 * 1000;
  const payload = `${left}+${right}.${exp}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return { token: `${Buffer.from(payload).toString("base64url")}.${sig}`, question: `What is ${left} + ${right}?`, answer: String(left + right) };
}

export function checkCaptcha(secret: string, token: string, answer: string, now = Date.now()) {
  const [encoded, sig] = String(token ?? "").split(".");
  if (!encoded || !sig) return false;
  let payload = "";
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return false;
  }
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
  const [sum, exp] = payload.split(".");
  if (Number(exp) < now) return false;
  const [a, b] = sum.split("+").map(Number);
  return String(a + b) === String(answer).trim();
}

export function allowPublicAttempt(stamps: number[], now: number, limit = 5, windowMs = 60 * 60 * 1000) {
  const recent = stamps.filter((stamp) => now - stamp < windowMs);
  return { ok: recent.length < limit, recent };
}

export function scorecardRow(input: { closed: number; tickets: number; withinSla: number; firstTime: number; scored: number; repeats: number; feedback: number; feedbackCount: number; tatHours: number | null }) {
  const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);
  return {
    closureRate: pct(input.closed, input.tickets),
    slaRate: pct(input.withinSla, input.closed),
    firstTimeFix: pct(input.firstTime, input.scored),
    repeatRate: pct(input.repeats, input.tickets),
    feedback: input.feedbackCount ? Math.round((input.feedback / input.feedbackCount) * 10) / 10 : null,
    tatHours: input.tatHours,
  };
}

export function mapsProvider(googleKey?: string | null) {
  return googleKey ? "google" : "osm";
}
