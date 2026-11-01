import { prisma } from "./db";
import { rankEngineers, type EngineerCandidate } from "@/lib/assignment";

let statsCache: { at: number; open: Map<string, number>; rates: Map<string, number> } | null = null;

export async function engineerStats() {
  if (!process.env.VITEST && statsCache && Date.now() - statsCache.at < 60_000) return statsCache;
  const rows = await prisma.$queryRaw<{ id: string; open: number; rate: number | null }[]>`
    SELECT "engineerId" AS id,
      COUNT(*) FILTER (WHERE status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING'))::int AS open,
      (COUNT(*) FILTER (WHERE status IN ('CLOSED','HAPPY_CALLING')))::float / NULLIF(COUNT(*), 0) AS rate
    FROM "Complaint"
    WHERE "engineerId" IS NOT NULL
    GROUP BY "engineerId"
  `;
  const open = new Map<string, number>();
  const rates = new Map<string, number>();
  for (const row of rows) {
    open.set(row.id, Number(row.open ?? 0));
    if (row.rate != null) rates.set(row.id, Number(row.rate));
  }
  const snapshot = { at: Date.now(), open, rates };
  if (!process.env.VITEST) statsCache = snapshot;
  return snapshot;
}

export async function suggestTechnicians(input: {
  companyId: string;
  pincode?: string | null;
  districtId?: string | null;
  stateId?: string | null;
  productType?: string | null;
  callType?: string | null;
}) {
  const [engineers, stats] = await Promise.all([
    prisma.engineer.findMany({ where: { companyId: input.companyId, active: true }, take: 300 }),
    engineerStats(),
  ]);
  const candidates: EngineerCandidate[] = engineers.map((engineer) => ({
    id: engineer.id,
    name: engineer.name,
    kind: engineer.kind,
    companyId: engineer.companyId,
    stateId: engineer.stateId,
    districtId: engineer.districtId,
    pincodes: engineer.pincodes,
    skills: engineer.skills,
    active: engineer.active,
  }));
  return rankEngineers(candidates, input, stats.open, stats.rates).slice(0, 5);
}
