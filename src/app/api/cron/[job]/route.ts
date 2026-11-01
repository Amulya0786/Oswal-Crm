import { runEscalation, runSummary } from "@/server/jobs";
import { warmDashboardCache } from "@/server/home";
import { json } from "@/server/http";

export async function POST(req: Request, context: { params: Promise<{ job: string }> }) {
  const secret = new URL(req.url).searchParams.get("key") || req.headers.get("x-cron-key");
  const expected = process.env.CRON_SECRET || (process.env.NODE_ENV === "production" ? "" : "dev-cron");
  if (!expected || secret !== expected) return json({ error: "Bad cron key" }, 401);
  const { job } = await context.params;
  if (job === "escalation") return json(await runEscalation({ maxBatches: 8 }));
  if (job === "summary") return json(await runSummary());
  if (job === "dashboard") return json(await warmDashboardCache());
  return json({ error: "Unknown job" }, 404);
}
