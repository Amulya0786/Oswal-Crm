import { clientIp } from "@/server/http";
import { reportError } from "@/server/monitor";

const hits = new Map<string, { n: number; at: number }>();

export async function POST(req: Request) {
  if (!process.env.SENTRY_DSN) return Response.json({ ok: true, reported: false });
  const ip = clientIp(req) ?? "unknown";
  const now = Date.now();
  const slot = hits.get(ip);
  if (!slot || now - slot.at > 60_000) hits.set(ip, { n: 1, at: now });
  else if (slot.n >= 10) return Response.json({ ok: true, reported: false });
  else slot.n += 1;
  const body = await req.json().catch(() => ({}));
  const message = String((body as { message?: unknown }).message ?? "Browser error").slice(0, 300);
  await reportError(new Error(message), "client");
  return Response.json({ ok: true, reported: true });
}
