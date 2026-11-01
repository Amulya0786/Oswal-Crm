import { prisma } from "./db";
import { rankEngineers, type EngineerCandidate } from "@/lib/assignment";
import { geoBonus, haversineKm } from "@/lib/phase2";

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
  lat?: number | null;
  lng?: number | null;
  slaRisk?: boolean;
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
  const ranked = rankEngineers(candidates, input, stats.open, stats.rates);
  const target = input.lat != null && input.lng != null ? { lat: input.lat, lng: input.lng } : null;
  if (!target && !input.slaRisk) return ranked.slice(0, 5);
  const ids = engineers.map((engineer) => engineer.id);
  const pings = ids.length
    ? await prisma.techPing.findMany({ where: { engineerId: { in: ids } }, orderBy: { at: "desc" }, take: 300 })
    : [];
  const latest = new Map<string, { lat: number; lng: number }>();
  for (const ping of pings) if (!latest.has(ping.engineerId)) latest.set(ping.engineerId, { lat: ping.lat, lng: ping.lng });
  for (const engineer of engineers) {
    if (!latest.has(engineer.id) && engineer.homeLat != null && engineer.homeLng != null) latest.set(engineer.id, { lat: engineer.homeLat, lng: engineer.homeLng });
  }
  return ranked
    .map((row) => {
      const point = latest.get(row.engineerId);
      const bonus = geoBonus(target && point ? haversineKm(target, point) : null, Boolean(input.slaRisk));
      return { ...row, score: row.score + bonus.score, reason: [row.reason, bonus.reason].filter(Boolean).join(" · ") };
    })
    .sort((a, b) => b.score - a.score || a.openCount - b.openCount)
    .slice(0, 5);
}
