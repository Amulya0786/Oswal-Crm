import { prisma } from "./db";
import { rankEngineers, type AssignmentInput, type EngineerCandidate } from "@/lib/assignment";
import { setting, settingNumber } from "./settings";
import { kolkataTodayStart, midnightShift } from "@/lib/time";
import { remember } from "./memory-cache";

/** Open complaints and average hours to close, one grouped scan, reused for a minute. */
export async function engineerStats() {
  return remember("engineer-stats", "all", 60_000, async () => {
    const since = new Date(Date.now() - 90 * 86400000);
    const rows = await prisma.$queryRaw<{ id: string; open: number; rate: number | null; hours: number | null }[]>`
      SELECT "engineerId" AS id,
        COUNT(*) FILTER (WHERE status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING'))::int AS open,
        (COUNT(*) FILTER (WHERE status IN ('CLOSED','HAPPY_CALLING') AND "closedAt" >= ${since}))::float
          / NULLIF(COUNT(*) FILTER (WHERE "bookDate" >= ${since}), 0) AS rate,
        AVG(EXTRACT(EPOCH FROM ("closedAt" - "bookDate")) / 3600)
          FILTER (WHERE status IN ('CLOSED','HAPPY_CALLING') AND "closedAt" IS NOT NULL AND "closedAt" >= ${since}) AS hours
      FROM "Complaint"
      WHERE "engineerId" IS NOT NULL AND "excludeFromMis" = false
      GROUP BY "engineerId"
    `;
    const open = new Map<string, number>();
    const rates = new Map<string, number>();
    const hours = new Map<string, number>();
    for (const row of rows) {
      open.set(row.id, Number(row.open ?? 0));
      if (row.rate != null) rates.set(row.id, Number(row.rate));
      if (row.hours != null) hours.set(row.id, Number(row.hours));
    }
    return { at: Date.now(), open, rates, hours };
  });
}

export async function suggestTechnicians(input: AssignmentInput) {
  if (!input.stateId) return [];
  const cap = input.dailyCap ?? await settingNumber("DAILY_VISIT_CAP", 8);
  const today = kolkataTodayStart();
  const tomorrow = midnightShift(new Date(), 1);
  const [engineers, stats] = await Promise.all([
    prisma.engineer.findMany({
      where: { companyId: input.companyId, active: true, stateId: input.stateId },
      include: { coveredDistricts: { select: { districtId: true } } },
    }),
    engineerStats(),
  ]);
  const ids = engineers.map((engineer) => engineer.id);
  const [punches, leaves, pings] = await Promise.all([
    ids.length ? prisma.attendancePunch.findMany({ where: { engineerId: { in: ids }, at: { gte: today, lt: tomorrow } }, orderBy: { at: "desc" } }) : [],
    ids.length ? prisma.leaveRequest.findMany({ where: { engineerId: { in: ids }, status: "APPROVED", from: { lte: tomorrow }, to: { gte: today } } }) : [],
    ids.length ? prisma.techPing.findMany({ where: { engineerId: { in: ids } }, orderBy: { at: "desc" }, take: Math.max(ids.length * 2, 20) }) : [],
  ]);
  const punched = new Map<string, string>();
  for (const punch of punches) if (!punched.has(punch.engineerId)) punched.set(punch.engineerId, punch.kind);
  const onLeave = new Set(leaves.map((row) => row.engineerId));
  const latest = new Map<string, { lat: number; lng: number }>();
  for (const ping of pings) if (!latest.has(ping.engineerId)) latest.set(ping.engineerId, { lat: ping.lat, lng: ping.lng });
  const candidates: EngineerCandidate[] = engineers.map((engineer) => ({
    id: engineer.id,
    name: engineer.name,
    kind: engineer.kind,
    companyId: engineer.companyId,
    stateId: engineer.stateId,
    districtId: engineer.districtId,
    districtIds: engineer.coveredDistricts.map((row) => row.districtId),
    pincodes: engineer.pincodes,
    skills: engineer.skills,
    category: engineer.category,
    brandId: engineer.brandId,
    active: engineer.active,
    punchedIn: punched.get(engineer.id) === "IN",
    onLeave: onLeave.has(engineer.id),
    homeLat: engineer.homeLat,
    homeLng: engineer.homeLng,
    lastLat: latest.get(engineer.id)?.lat ?? null,
    lastLng: latest.get(engineer.id)?.lng ?? null,
  }));
  return rankEngineers(candidates, { ...input, dailyCap: cap }, stats.open, stats.rates).slice(0, 8);
}

export async function previousTechnician(phone: string, serialNorm: string | null, stateId: string | null) {
  const since = new Date(Date.now() - 30 * 86400000);
  const row = await prisma.complaint.findFirst({
    where: {
      engineerId: { not: null },
      bookDate: { gte: since },
      excludeFromMis: false,
      OR: [{ phone }, ...(serialNorm ? [{ serialNorm }] : [])],
    },
    orderBy: { bookDate: "desc" },
    select: { engineerId: true, stateId: true },
  });
  if (!row?.engineerId) return { engineerId: null as string | null, repeatCount: 0 };
  const repeatCount = await prisma.complaint.count({
    where: { phone, bookDate: { gte: since }, excludeFromMis: false, ...(stateId ? { stateId } : {}) },
  });
  return { engineerId: row.engineerId, repeatCount };
}

export async function queueAssignment(complaintId: string) {
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId }, include: { company: true } });
  if (!complaint || complaint.engineerId || !complaint.stateId) return null;
  const prior = await previousTechnician(complaint.phone, complaint.serialNorm, complaint.stateId);
  const ranked = await suggestTechnicians({
    companyId: complaint.companyId,
    stateId: complaint.stateId,
    districtId: complaint.districtId,
    pincode: complaint.pincode,
    callType: complaint.callType,
    brandId: complaint.brandId,
    companyCode: complaint.company.code,
    lat: complaint.lat,
    lng: complaint.lng,
    previousEngineerId: prior.engineerId,
    repeatCount: prior.repeatCount,
  });
  const top = ranked[0];
  const auto = (await setting("AUTO_ASSIGN")) === "1";
  await prisma.complaint.update({
    where: { id: complaint.id },
    data: {
      suggestedEngineerId: top?.engineerId ?? null,
      suggestedName: top?.name ?? null,
      seniorReview: Boolean(top?.senior),
      ...(auto && top
        ? { engineerId: top.engineerId, assignedName: top.name, assignedAt: new Date(), offeredAt: new Date(), status: "ASSIGNED", finalStatus: "Assigned", assignReason: top.reason }
        : {}),
    },
  });
  return { suggestion: top ?? null, auto: Boolean(auto && top) };
}

export async function confirmAssignment(ids: string[], engineerId?: string | null, reason?: string | null, actor?: { role: string; stateIds: string[] }) {
  const now = new Date();
  let updated = 0;
  const skipped: { ticketNo: string; reason: string }[] = [];
  for (const id of ids) {
    const row = await prisma.complaint.findUnique({ where: { id }, include: { company: true } });
    if (!row) { skipped.push({ ticketNo: id, reason: "Not found" }); continue; }
    const chosen = engineerId || row.suggestedEngineerId;
    if (!chosen) { skipped.push({ ticketNo: row.ticketNo, reason: "No technician chosen" }); continue; }
    const engineer = await prisma.engineer.findUnique({ where: { id: chosen } });
    if (!engineer) { skipped.push({ ticketNo: row.ticketNo, reason: "Technician not found" }); continue; }
    if (actor?.role === "STATE_HEAD" && row.stateId && !actor.stateIds.includes(row.stateId)) {
      skipped.push({ ticketNo: row.ticketNo, reason: "Outside your state" });
      continue;
    }
    if (engineer.companyId !== row.companyId) { skipped.push({ ticketNo: row.ticketNo, reason: "Technician is in another company" }); continue; }
    if (row.stateId && engineer.stateId && engineer.stateId !== row.stateId) {
      await prisma.deskAlert.create({
        data: { kind: "STATE_CHANGE", complaintId: row.id, stateId: row.stateId, engineerId: engineer.id, message: `${row.ticketNo} stayed in its state. ${engineer.name} belongs to another state.` },
      });
      skipped.push({ ticketNo: row.ticketNo, reason: "Technician is in another state" });
      continue;
    }
    await prisma.complaint.update({
      where: { id },
      data: {
        engineerId: engineer.id,
        assignedName: engineer.name,
        assignedAt: now,
        offeredAt: now,
        acceptedAt: null,
        status: row.engineerId ? "REASSIGNED" : "ASSIGNED",
        finalStatus: row.engineerId ? "Re-assigned" : "Assigned",
        assignReason: reason?.slice(0, 240) || "Confirmed from the assign queue",
        version: { increment: 1 },
      },
    });
    await prisma.complaintEvent.create({
      data: { complaintId: id, type: row.engineerId ? "REASSIGNED" : "ASSIGNED", message: `${row.engineerId ? "Re-assigned" : "Assigned"} to ${engineer.name}${reason ? `: ${reason}` : ""}` },
    });
    const { notifyComplaint } = await import("./notify");
    await notifyComplaint({
      event: "ASSIGNED",
      companyId: row.companyId,
      companyName: row.company.shortName,
      complaintId: row.id,
      ticketNo: row.ticketNo,
      customerName: row.customerName,
      phone: engineer.phone || row.phone,
      engineer: engineer.name,
      status: row.engineerId ? "REASSIGNED" : "ASSIGNED",
    });
    updated += 1;
  }
  return { updated, skipped };
}

export async function sweepAssignmentQueue() {
  const assignHours = await settingNumber("ASSIGN_WAIT_HOURS", 1);
  const acceptHours = await settingNumber("ACCEPT_WAIT_HOURS", 2);
  const assignBefore = new Date(Date.now() - assignHours * 3600000);
  const acceptBefore = new Date(Date.now() - acceptHours * 3600000);
  const batchSize = 500;
  let alerts = 0;
  let guard = "";
  for (;;) {
    // Imported Smartlogics backlog has no CREATED event, and new imports are source IMPORT.
    // Oldest live bookings first. An open unassigned alert is not picked again.
    const waiting = await prisma.$queryRaw<{ id: string; ticketNo: string; stateId: string | null }[]>`
      SELECT c.id, c."ticketNo", c."stateId"
      FROM "Complaint" c
      WHERE c.status = 'OPEN'
        AND c."engineerId" IS NULL
        AND c."excludeFromMis" = false
        AND c."bookDate" < ${assignBefore}
        AND c.source <> 'IMPORT'
        AND EXISTS (
          SELECT 1 FROM "ComplaintEvent" e
          WHERE e."complaintId" = c.id AND e.type = 'CREATED'
        )
        AND NOT EXISTS (
          SELECT 1 FROM "DeskAlert" a
          WHERE a."complaintId" = c.id AND a.kind = 'UNASSIGNED' AND a."readAt" IS NULL
        )
      ORDER BY c."bookDate" ASC, c.id ASC
      LIMIT ${batchSize}
    `;
    if (!waiting.length || waiting[0].id === guard) break;
    guard = waiting[0].id;
    await prisma.deskAlert.createMany({
      data: waiting.map((row) => ({
        kind: "UNASSIGNED",
        complaintId: row.id,
        stateId: row.stateId,
        message: `${row.ticketNo} has been unassigned for more than ${assignHours} hour(s)`,
      })),
    });
    alerts += waiting.length;
    if (waiting.length < batchSize) break;
  }
  const stale = await prisma.complaint.findMany({
    where: { status: { in: ["ASSIGNED", "REASSIGNED"] }, acceptedAt: null, offeredAt: { lt: acceptBefore }, excludeFromMis: false },
    take: 100,
  });
  for (const row of stale) {
    await prisma.complaint.update({
      where: { id: row.id },
      data: { status: "OPEN", engineerId: null, assignedName: null, offeredAt: null, finalStatus: "Open", version: { increment: 1 } },
    });
    await prisma.complaintEvent.create({
      data: { complaintId: row.id, type: "ASSIGNMENT", message: `Returned to the queue. Not accepted within ${acceptHours} hour(s).` },
    });
    await prisma.deskAlert.create({
      data: { kind: "NOT_ACCEPTED", complaintId: row.id, stateId: row.stateId, message: `${row.ticketNo} was not accepted and is back in the queue` },
    });
  }
  return { waiting: alerts, returned: stale.length, alerts };
}

export async function respondToOffer(engineerId: string, complaintId: string, decision: "accept" | "reject", reason?: string | null) {
  const row = await prisma.complaint.findFirst({ where: { id: complaintId, engineerId } });
  if (!row) return null;
  if (decision === "accept") {
    await prisma.complaint.update({ where: { id: row.id }, data: { acceptedAt: new Date(), version: { increment: 1 } } });
    await prisma.complaintEvent.create({ data: { complaintId: row.id, type: "ASSIGNED", message: "Technician accepted the complaint" } });
    return { ok: true };
  }
  await prisma.complaint.update({
    where: { id: row.id },
    data: { status: "OPEN", engineerId: null, assignedName: null, offeredAt: null, acceptedAt: null, finalStatus: "Open", version: { increment: 1 } },
  });
  await prisma.complaintEvent.create({
    data: { complaintId: row.id, type: "ASSIGNMENT", message: `Technician rejected the complaint${reason ? `: ${reason}` : ""}` },
  });
  await prisma.deskAlert.create({
    data: { kind: "REJECTED", complaintId: row.id, stateId: row.stateId, engineerId, message: `${row.ticketNo} was rejected${reason ? `: ${reason}` : ""}` },
  });
  await queueAssignment(row.id);
  return { ok: true };
}

export async function changeEngineerState(engineerId: string, stateId: string, districtIds: string[], note?: string | null) {
  const engineer = await prisma.engineer.findUnique({ where: { id: engineerId } });
  if (!engineer) return null;
  const previous = engineer.stateId;
  await prisma.$transaction(async (tx) => {
    await tx.engineerStateHistory.create({ data: { engineerId, stateId, note: note ?? null } });
    await tx.engineer.update({ where: { id: engineerId }, data: { stateId, districtId: districtIds[0] ?? null } });
    await tx.engineerDistrict.deleteMany({ where: { engineerId } });
    if (districtIds.length) await tx.engineerDistrict.createMany({ data: districtIds.map((districtId) => ({ engineerId, districtId })) });
  });
  if (previous && previous !== stateId) {
    const open = await prisma.complaint.count({ where: { engineerId, stateId: previous, status: { in: ["OPEN", "ASSIGNED", "REASSIGNED", "PENDING"] } } });
    if (open) {
      await prisma.deskAlert.create({
        data: { kind: "STATE_MOVE", engineerId, stateId: previous, message: `${engineer.name} moved state. ${open} open complaint(s) stay in the old state.` },
      });
    }
  }
  return { ok: true, previous };
}

export async function reassignOpenComplaints(engineerId: string) {
  const rows = await prisma.complaint.findMany({
    where: { engineerId, status: { in: ["OPEN", "ASSIGNED", "REASSIGNED", "PENDING"] } },
    select: { id: true },
  });
  for (const row of rows) {
    await prisma.complaint.update({ where: { id: row.id }, data: { engineerId: null, assignedName: null, status: "OPEN", offeredAt: null, finalStatus: "Open" } });
    await queueAssignment(row.id);
  }
  return { queued: rows.length };
}
