import { healthBody } from "@/lib/health";
import { configuredPool } from "@/server/db-url";
import { prisma } from "@/server/db";
import { startScheduler } from "@/server/jobs";

export async function GET() {
  startScheduler();
  const started = Date.now();
  const pool = configuredPool();
  const dbStarted = Date.now();
  try {
    const rows = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
    const dbMs = Date.now() - dbStarted;
    const dbOk = rows[0]?.ok === 1;
    const body = healthBody({ dbOk, dbMs, totalMs: Date.now() - started, limit: pool.limit });
    return Response.json(body, { status: dbOk ? 200 : 503 });
  } catch (error) {
    const { reportError } = await import("@/server/monitor");
    await reportError(error, "health");
    const body = healthBody({ dbOk: false, dbMs: Date.now() - dbStarted, totalMs: Date.now() - started, limit: pool.limit });
    return Response.json(body, { status: 503 });
  }
}
