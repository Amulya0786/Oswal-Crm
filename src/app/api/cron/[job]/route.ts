import { runEscalation, runSummary } from "@/server/jobs";
import { json } from "@/server/http";

export async function POST(req: Request, context: { params: Promise<{ job: string }> }) {
  const secret = new URL(req.url).searchParams.get("key") || req.headers.get("x-cron-key");
  if (secret !== (process.env.CRON_SECRET || "dev-cron")) return json({ error: "Bad cron key" }, 401);
  const { job } = await context.params;
  if (job === "escalation") return json(await runEscalation({ maxBatches: 8 }));
  if (job === "summary") return json(await runSummary());
  return json({ error: "Unknown job" }, 404);
}
