import { Prisma } from "@prisma/client";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma, bumpVersion } from "./db";
import { loadRiskContext } from "./query";
import { riskPredicate, ACTIVE } from "./scope";
import { matchesRule, parseRule, type RuleDefinition } from "@/lib/rules";
import { notifyComplaint, deliver } from "./notify";
import { textPdf } from "@/lib/pdf";
import { kolkataTodayStart, midnightShift, formatDay } from "@/lib/time";

type LadderUser = { id: string; name: string; role: string };

export async function runEscalation(opts?: { force?: boolean; maxBatches?: number; now?: Date }) {
  const locked = await prisma.$queryRaw<{ ok: boolean }[]>`SELECT pg_try_advisory_lock(861001) AS ok`;
  if (!locked[0]?.ok) return { skipped: true as const, escalated: 0, rulesFired: 0, ms: 0 };
  const started = Date.now();
  try {
    const now = opts?.now ?? new Date();
    const ctx = await loadRiskContext(now);
    await prisma.$executeRaw`
      UPDATE "Complaint"
      SET "slaBreached" = (status IN (${Prisma.join(ACTIVE)}) AND "slaDueAt" IS NOT NULL AND "slaDueAt" <= ${now}),
          "slaRisk" = ${riskPredicate(ctx)}
      WHERE status IN (${Prisma.join(ACTIVE)}) OR "slaBreached" = true OR "slaRisk" = true
    `;
    const escalated = await escalateBreaches({ force: opts?.force, maxBatches: opts?.maxBatches ?? 6, now });
    const rulesFired = await runRules(now, opts?.maxBatches ?? 4);
    await bumpVersion();
    return { skipped: false as const, escalated, rulesFired, ms: Date.now() - started };
  } finally {
    await prisma.$executeRaw`SELECT pg_advisory_unlock(861001)`;
  }
}

async function escalateBreaches(opts: { force?: boolean; maxBatches: number; now: Date }) {
  const hours = Number(process.env.ESCALATION_COOLDOWN_HOURS ?? 4);
  const cutoff = new Date(opts.now.getTime() - hours * 3600 * 1000);
  const ladder = await loadLadder();
  let escalated = 0;
  const touched = new Set<string>();
  for (let batch = 0; batch < opts.maxBatches; batch++) {
    const rows = await prisma.$queryRaw<{
      id: string; ticketNo: string; companyId: string; districtId: string | null; stateId: string | null;
      escalationLevel: number; customerName: string; phone: string; status: string;
    }[]>`
      SELECT id, "ticketNo", "companyId", "districtId", "stateId", "escalationLevel", "customerName", phone, status
      FROM "Complaint"
      WHERE status IN (${Prisma.join(ACTIVE)})
        AND "slaDueAt" IS NOT NULL
        AND "slaDueAt" <= ${opts.now}
        AND "escalationLevel" < 3
        AND (${opts.force ? Prisma.sql`"escalatedAt" IS NULL OR "escalatedAt" < ${opts.now}` : Prisma.sql`"escalatedAt" IS NULL OR "escalatedAt" <= ${cutoff}`})
      ORDER BY "slaDueAt" ASC
      LIMIT 500
    `;
    const pending = rows.filter((row) => !touched.has(row.id));
    if (!pending.length) break;
    const moved = await applyEscalations(pending, ladder, opts.now, touched);
    escalated += moved;
    if (rows.length < 500 || moved === 0) break;
  }
  return escalated;
}

async function loadLadder() {
  const users = await prisma.user.findMany({
    where: { active: true, role: { in: ["AREA_MANAGER", "STATE_HEAD", "ADMIN"] } },
    include: { districts: true, states: true },
    orderBy: { name: "asc" },
  });
  const byDistrict = new Map<string, LadderUser>();
  const byState = new Map<string, LadderUser>();
  let admin: LadderUser | null = null;
  for (const user of users) {
    const brief = { id: user.id, name: user.name, role: user.role };
    if (user.role === "ADMIN" && !admin) admin = brief;
    if (user.role === "AREA_MANAGER") for (const link of user.districts) if (!byDistrict.has(link.districtId)) byDistrict.set(link.districtId, brief);
    if (user.role === "STATE_HEAD") for (const link of user.states) if (!byState.has(link.stateId)) byState.set(link.stateId, brief);
  }
  return { byDistrict, byState, admin };
}

function nextStep(
  row: { districtId: string | null; stateId: string | null; escalationLevel: number },
  ladder: Awaited<ReturnType<typeof loadLadder>>,
) {
  const level = row.escalationLevel;
  if (level < 1 && row.districtId && ladder.byDistrict.get(row.districtId)) {
    return { level: 1, user: ladder.byDistrict.get(row.districtId)!, title: "area manager" };
  }
  if (level < 2 && row.stateId && ladder.byState.get(row.stateId)) {
    return { level: 2, user: ladder.byState.get(row.stateId)!, title: "state head" };
  }
  if (level < 3 && ladder.admin) return { level: 3, user: ladder.admin, title: "admin" };
  if (level < 2 && ladder.admin) return { level: 3, user: ladder.admin, title: "admin" };
  return null;
}

async function applyEscalations(
  rows: { id: string; ticketNo: string; companyId: string; districtId: string | null; stateId: string | null; escalationLevel: number; customerName: string; phone: string; status: string }[],
  ladder: Awaited<ReturnType<typeof loadLadder>>,
  now: Date,
  touched: Set<string>,
) {
  const planned: { id: string; level: number; userId: string; name: string; title: string; from: number; ticketNo: string; companyId: string; customerName: string; phone: string; status: string }[] = [];
  for (const row of rows) {
    const step = nextStep(row, ladder);
    if (!step) continue;
    touched.add(row.id);
    planned.push({ id: row.id, level: step.level, userId: step.user.id, name: step.user.name, title: step.title, from: row.escalationLevel, ticketNo: row.ticketNo, companyId: row.companyId, customerName: row.customerName, phone: row.phone, status: row.status });
  }
  if (!planned.length) return 0;
  const values = Prisma.join(planned.map((row) => Prisma.sql`(${row.id}, ${row.level}::int, ${row.userId})`));
  await prisma.$executeRaw`
    UPDATE "Complaint" AS c
    SET "escalationLevel" = v.level,
        "escalatedToId" = v.uid,
        "escalatedAt" = ${now},
        "updatedAt" = ${now}
    FROM (VALUES ${values}) AS v(id, level, uid)
    WHERE c.id = v.id
  `;
  await prisma.escalationLog.createMany({
    data: planned.map((row) => ({
      complaintId: row.id,
      fromLevel: row.from,
      toLevel: row.level,
      toUserId: row.userId,
      toName: row.name,
      message: `${row.ticketNo} escalated to ${row.title} ${row.name}`,
    })),
  });
  await prisma.complaintEvent.createMany({
    data: planned.map((row) => ({
      complaintId: row.id,
      type: "ESCALATED",
      actorName: "Scheduler",
      message: `Escalated to ${row.title} ${row.name}`,
    })),
  });
  const companies = await prisma.company.findMany({ select: { id: true, shortName: true } });
  const names = new Map(companies.map((company) => [company.id, company.shortName]));
  await prisma.notificationLog.createMany({
    data: planned.map((row) => ({
      companyId: row.companyId,
      complaintId: row.id,
      channel: "EMAIL",
      recipient: row.name,
      event: "ESCALATION",
      body: `${names.get(row.companyId) ?? "Oswal"}: ${row.ticketNo} escalated to ${row.name}`,
      provider: "console",
      status: "LOGGED",
    })),
  });
  console.log(`[notify:batch] escalation ${planned.length} complaints`);
  return planned.length;
}

async function runRules(now: Date, maxBatches: number) {
  const rules = await prisma.rule.findMany({ where: { active: true }, take: 50 });
  let fired = 0;
  for (const rule of rules) {
    const definition = parseRule(rule.definition);
    if (!definition) continue;
    for (let batch = 0; batch < maxBatches; batch++) {
      const moved = await fireRule(rule.id, rule.companyId, rule.name, definition, now);
      fired += moved;
      if (moved < 400) break;
    }
  }
  return fired;
}

async function fireRule(ruleId: string, companyId: string | null, name: string, definition: RuleDefinition, now: Date) {
  const parts: Prisma.Sql[] = [Prisma.sql`status IN (${Prisma.join(ACTIVE)})`];
  if (companyId) parts.push(Prisma.sql`"companyId" = ${companyId}`);
  for (const condition of definition.all) {
    if (condition.field === "ageHours") {
      const boundary = new Date(now.getTime() - Number(condition.value) * 3600 * 1000);
      if (condition.op === "gt" || condition.op === "gte") parts.push(Prisma.sql`"bookDate" <= ${boundary}`);
    } else if (condition.op === "eq") {
      const allowed = new Set(["callType", "status", "districtId", "stateId", "companyId", "priority", "source", "brandId"]);
      if (allowed.has(condition.field)) parts.push(Prisma.sql`${Prisma.raw(`"${condition.field}"`)} = ${String(condition.value)}`);
    }
  }
  const where = Prisma.join(parts, " AND ");
  const rows = await prisma.$queryRaw<{
    id: string; callType: string; status: string; districtId: string | null; stateId: string | null; companyId: string;
    priority: string; source: string; brandId: string | null; bookDate: Date; ticketNo: string; escalationLevel: number;
    customerName: string; phone: string; districtId2?: string;
  }[]>`
    SELECT id, "callType", status, "districtId", "stateId", "companyId", priority, source, "brandId", "bookDate",
           "ticketNo", "escalationLevel", "customerName", phone
    FROM "Complaint"
    WHERE ${where}
      AND NOT EXISTS (SELECT 1 FROM "RuleFire" f WHERE f."ruleId" = ${ruleId} AND f."complaintId" = "Complaint".id)
    LIMIT 400
  `;
  const matched = rows.filter((row) => matchesRule(definition, {
    callType: row.callType,
    status: row.status,
    districtId: row.districtId,
    stateId: row.stateId,
    companyId: row.companyId,
    priority: row.priority,
    source: row.source,
    brandId: row.brandId,
    ageHours: (now.getTime() - new Date(row.bookDate).getTime()) / 36e5,
  }));
  if (!matched.length) return 0;
  await prisma.ruleFire.createMany({
    data: matched.map((row) => ({ ruleId, complaintId: row.id, detail: name })),
    skipDuplicates: true,
  });
  for (const action of definition.actions) {
    if (action.type === "setPriority") {
      await prisma.complaint.updateMany({ where: { id: { in: matched.map((row) => row.id) } }, data: { priority: action.value } });
    }
    if (action.type === "escalate") {
      const ladder = await loadLadder();
      await applyEscalations(matched, ladder, now, new Set());
    }
  }
  await prisma.complaintEvent.createMany({
    data: matched.map((row) => ({
      complaintId: row.id,
      type: "RULE",
      actorName: "Rules",
      message: `Rule “${name}” matched`,
    })),
  });
  return matched.length;
}

export async function runSummary(now = new Date()) {
  const start = midnightShift(now, -1);
  const end = kolkataTodayStart(now);
  const companies = await prisma.company.findMany({ orderBy: { code: "asc" } });
  const lines = [`Oswal service summary for ${formatDay(start)}`];
  for (const company of companies) {
    const rows = await prisma.$queryRaw<{ logged: number; closed: number; pending: number; breach: number }[]>`
      SELECT
        COUNT(*) FILTER (WHERE "bookDate" >= ${start} AND "bookDate" < ${end})::int AS logged,
        COUNT(*) FILTER (WHERE status = 'CLOSED' AND "closedAt" >= ${start} AND "closedAt" < ${end})::int AS closed,
        COUNT(*) FILTER (WHERE status IN (${Prisma.join(ACTIVE)}))::int AS pending,
        COUNT(*) FILTER (WHERE status IN (${Prisma.join(ACTIVE)}) AND "slaDueAt" <= ${now})::int AS breach
      FROM "Complaint" WHERE "companyId" = ${company.id}
    `;
    const row = rows[0];
    lines.push(`${company.shortName}: logged ${row?.logged ?? 0}, closed ${row?.closed ?? 0}, pending ${row?.pending ?? 0}, SLA breached ${row?.breach ?? 0}`);
  }
  const origin = process.env.APP_URL ?? "http://localhost:3000";
  const html = `<article style="font-family:Inter,Arial,sans-serif;color:#242424"><div style="background:#02502f;padding:16px 20px"><img src="${origin}/brand/pumps-logo.png" alt="Oswal" height="64" /></div><h1>Oswal daily summary</h1><ul>${lines.slice(1).map((line) => `<li>${line}</li>`).join("")}</ul></article>`;
  const pdf = textPdf("Oswal daily summary", lines);
  const dir = path.join(process.cwd(), "data", "summaries");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `summary-${formatDay(start).replace(/\s/g, "-")}.pdf`);
  await writeFile(file, pdf);
  await prisma.appSetting.upsert({
    where: { key: "lastSummary" },
    create: { key: "lastSummary", value: JSON.stringify({ html, file, at: now.toISOString(), lines }) },
    update: { value: JSON.stringify({ html, file, at: now.toISOString(), lines }) },
  });
  const to = process.env.SUMMARY_EMAIL ?? "management@oswal.test";
  await deliver({ channel: "EMAIL", to, subject: "Oswal daily summary", body: lines.join("\n") });
  await prisma.notificationLog.create({
    data: { channel: "EMAIL", recipient: to, event: "SUMMARY", body: lines.join("\n"), provider: "console", status: "LOGGED", detail: file },
  });
  return { lines, file };
}

let schedulerStarted = false;
export function startScheduler() {
  if (schedulerStarted || process.env.ENABLE_JOBS === "0" || process.env.VITEST) return;
  schedulerStarted = true;
  setInterval(() => {
    void runEscalation().catch((error) => console.error("escalation job", error));
  }, 5 * 60 * 1000);
}
