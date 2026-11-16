import { prisma } from "./db";

const GAP_MS = 5 * 60 * 1000;

function kick() {
  if (process.env.VITEST || process.env.ENABLE_JOBS === "0") return;
  setImmediate(() => {
    void processJobs(1).catch((error) => console.error("job runner", error));
  });
}

export async function enqueueJob(kind: string, payload: Record<string, unknown> = {}) {
  const job = await prisma.backgroundJob.create({
    data: { kind, payload: JSON.stringify(payload), status: "QUEUED" },
  });
  kick();
  return job;
}

/** Skip when the same kind is already waiting, running, or finished inside the gap. */
export async function enqueueSpaced(kind: string, minGapMs = GAP_MS) {
  const open = await prisma.backgroundJob.findFirst({ where: { kind, status: { in: ["QUEUED", "RUNNING"] } } });
  if (open) return open;
  const last = await prisma.backgroundJob.findFirst({ where: { kind, status: "DONE" }, orderBy: { finishedAt: "desc" } });
  if (last?.finishedAt && Date.now() - last.finishedAt.getTime() < minGapMs) return last;
  return enqueueJob(kind);
}

/** One row per kind per day, so a restart does not send the morning report twice. */
export async function enqueueDaily(kind: string, day: string) {
  const payload = JSON.stringify({ day });
  const existing = await prisma.backgroundJob.findFirst({ where: { kind, payload } });
  if (existing) return existing;
  return enqueueJob(kind, { day });
}

export async function processJobs(limit = 1) {
  const now = new Date();
  const stale = new Date(now.getTime() - 15 * 60 * 1000);
  await prisma.$executeRaw`
    UPDATE "BackgroundJob"
    SET status = 'QUEUED', "lockedAt" = NULL
    WHERE status = 'RUNNING' AND "lockedAt" IS NOT NULL AND "lockedAt" < ${stale}
  `;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    WITH picked AS (
      SELECT id FROM "BackgroundJob"
      WHERE status = 'QUEUED' AND "runAt" <= ${now}
      ORDER BY "runAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    UPDATE "BackgroundJob" AS job
    SET status = 'RUNNING', "lockedAt" = ${now}, attempts = attempts + 1
    FROM picked
    WHERE job.id = picked.id
    RETURNING job.id
  `;
  const processed: { id: string; kind: string; status: string }[] = [];
  for (const row of rows) {
    const job = await prisma.backgroundJob.findUnique({ where: { id: row.id } });
    if (!job) continue;
    try {
      await runKind(job.kind, job.payload);
      await prisma.backgroundJob.update({ where: { id: job.id }, data: { status: "DONE", finishedAt: new Date(), error: null } });
      processed.push({ id: job.id, kind: job.kind, status: "DONE" });
    } catch (error) {
      const message = (error instanceof Error ? error.message : "Job failed").slice(0, 300);
      const giveUp = job.attempts >= 3;
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: giveUp
          ? { status: "FAILED", finishedAt: new Date(), error: message }
          : { status: "QUEUED", runAt: new Date(Date.now() + GAP_MS), error: message },
      });
      const { reportError } = await import("./monitor");
      await reportError(error, `job:${job.kind}`);
      processed.push({ id: job.id, kind: job.kind, status: giveUp ? "FAILED" : "RETRY" });
    }
  }
  return { processed };
}

async function runKind(kind: string, payload: string) {
  const data = JSON.parse(payload || "{}") as { exportId?: string };
  if (kind === "export") {
    const { runExport } = await import("./exports");
    await runExport(String(data.exportId ?? ""));
    return;
  }
  if (kind === "escalation") {
    const { runEscalation } = await import("./jobs");
    await runEscalation({ maxBatches: 4 });
    return;
  }
  if (kind === "summary") {
    const { runSummary } = await import("./jobs");
    await runSummary();
    return;
  }
  if (kind === "ageing") {
    const { runAgeingDigest } = await import("./jobs");
    await runAgeingDigest();
    return;
  }
  if (kind === "dashboard") {
    const { warmDashboardCache } = await import("./home");
    const { sweepAssignmentQueue } = await import("./assignment");
    await warmDashboardCache();
    await sweepAssignmentQueue();
    return;
  }
  if (kind === "archive") {
    const { archiveClosedTickets } = await import("./archive");
    await archiveClosedTickets();
    return;
  }
  throw new Error(`Unknown job ${kind}`);
}
