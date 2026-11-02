import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { json, readJson } from "./http";
import type { SessionUser } from "@/lib/types";
import { dataHealth, purgeQa, repairName, undoLastPurge } from "./data-health";
import { mergeDistricts, searchPlaces, seedCities, seedDistrictAliases, seedTehsils } from "./places";
import { changeEngineerState, confirmAssignment, reassignOpenComplaints, sweepAssignmentQueue } from "./assignment";
import { allSettings, saveSetting } from "./settings";
import { repeatProgress, startRepeatRebuild } from "./repeats";
import { aliasMergePlan, applyAliasMerges } from "./district-merge";

function admin(user: SessionUser) {
  return user.role === "ADMIN";
}

/** New desk routes live here so later QA fixes can be added without growing the main router. */
export async function release3(method: string, head: string, id: string | undefined, user: SessionUser, req: Request, url: URL) {
  if (head === "geo" && method === "GET") {
    return json({ rows: await searchPlaces(url.searchParams.get("kind") ?? "district", url.searchParams.get("q") ?? "", url.searchParams.get("stateId"), url.searchParams.get("districtId")) });
  }
  if (head === "health" && method === "GET") {
    if (!admin(user)) return json({ error: "Admins only" }, 403);
    return json(await dataHealth());
  }
  if (head === "health" && method === "POST" && id === "purge") {
    if (!admin(user)) return json({ error: "Admins only" }, 403);
    const body = await readJson(req);
    if (body.undo === true) return json(await undoLastPurge());
    return json(await purgeQa(body.apply === true));
  }
  if (head === "health" && method === "POST" && id === "repair-name") {
    if (!admin(user)) return json({ error: "Admins only" }, 403);
    const body = await readJson(req);
    return json(await repairName(String(body.ticketNo ?? ""), String(body.customerName ?? "").slice(0, 120)));
  }
  if (head === "health" && method === "POST" && id === "aliases") {
    if (!admin(user)) return json({ error: "Admins only" }, 403);
    return json(await seedDistrictAliases());
  }
  if (head === "health" && method === "POST" && id === "tehsils") {
    if (!admin(user)) return json({ error: "Admins only" }, 403);
    return json(await seedTehsils());
  }
  if (head === "health" && method === "POST" && id === "rules") {
    if (!admin(user)) return json({ error: "Admins only" }, 403);
    const defs = [
      ["First contact crossed", { all: [{ field: "ageHours", op: "gte", value: 24 }, { field: "status", op: "eq", value: "OPEN" }], actions: [{ type: "escalate" }, { type: "notify", channel: "WHATSAPP" }] }],
      ["Resolution 75 percent", { all: [{ field: "ageHours", op: "gte", value: 36 }], actions: [{ type: "notify", channel: "WHATSAPP" }] }],
      ["Resolution crossed", { all: [{ field: "ageHours", op: "gte", value: 48 }], actions: [{ type: "escalate" }, { type: "notify", channel: "EMAIL" }] }],
      ["Resolution crossed twice", { all: [{ field: "ageHours", op: "gte", value: 96 }], actions: [{ type: "escalate" }] }],
    ] as const;
    for (const [name, definition] of defs) {
      const existing = await prisma.rule.findFirst({ where: { name } });
      if (!existing) await prisma.rule.create({ data: { name, definition: JSON.stringify(definition), active: true } });
    }
    return json({ seeded: defs.length });
  }
  if (head === "health" && method === "POST" && id === "merge-aliases") {
    if (!admin(user)) return json({ error: "Admins only" }, 403);
    const body = await readJson(req);
    if (body.apply === true) return json(await applyAliasMerges(user.id));
    return json(await aliasMergePlan());
  }
  if (head === "health" && method === "POST" && id === "pincodes") {
    if (!admin(user)) return json({ error: "Admins only" }, 403);
    const { linkLoosePincodes } = await import("./pincode-blocks");
    return json(await linkLoosePincodes());
  }
  if (head === "health" && method === "POST" && id === "cities") {
    if (!admin(user)) return json({ error: "Admins only" }, 403);
    return json(await seedCities());
  }
  if (head === "districts" && method === "POST" && id === "merge") {
    if (!admin(user)) return json({ error: "Admins only" }, 403);
    const body = await readJson(req);
    return json(await mergeDistricts(String(body.fromId), String(body.toId), user.id));
  }
  if (head === "alerts" && method === "GET") {
    if (user.role !== "ADMIN" && user.role !== "STATE_HEAD") return json({ error: "Not your desk" }, 403);
    const stateLimit = user.role === "STATE_HEAD" ? { OR: [{ stateId: { in: user.stateIds.length ? user.stateIds : ["none"] } }, { stateId: null }] } : {};
    const [rows, unread] = await Promise.all([
      prisma.deskAlert.findMany({ where: { ...stateLimit, readAt: null }, orderBy: { createdAt: "desc" }, take: 30 }),
      prisma.deskAlert.count({ where: { ...stateLimit, readAt: null } }),
    ]);
    return json({ unread, rows });
  }
  if (head === "alerts" && method === "POST") {
    if (user.role !== "ADMIN" && user.role !== "STATE_HEAD") return json({ error: "Not your desk" }, 403);
    const body = await readJson(req);
    await prisma.deskAlert.update({ where: { id: String(body.id) }, data: { readAt: new Date() } });
    return json({ ok: true });
  }
  if (head === "assign" && method === "GET") {
    if (!user.caps.assign) return json({ error: "You cannot assign" }, 403);
    try { await sweepAssignmentQueue(); } catch { /* the queue still loads if the sweep cannot write */ }
    const pageSize = 50;
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const ageDays = Number(url.searchParams.get("age") ?? 0);
    const where = {
      status: "OPEN" as const,
      engineerId: null,
      excludeFromMis: false,
      ...(user.role === "STATE_HEAD" ? { stateId: { in: user.stateIds.length ? user.stateIds : ["none"] } } : {}),
      ...(url.searchParams.get("callType") ? { callType: url.searchParams.get("callType")! } : {}),
      ...(url.searchParams.get("district") ? { districtName: { contains: url.searchParams.get("district")!, mode: "insensitive" as const } } : {}),
      ...(url.searchParams.get("sla") === "1" ? { slaBreached: true } : {}),
      ...(ageDays > 0 ? { bookDate: { lte: new Date(Date.now() - ageDays * 86400000) } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.complaint.findMany({
        where,
        orderBy: [{ bookDate: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, ticketNo: true, customerName: true, stateName: true, districtName: true, callType: true, suggestedName: true, suggestedEngineerId: true, seniorReview: true, bookDate: true },
      }),
      prisma.complaint.count({ where }),
    ]);
    return json({ rows, page, pageSize, total });
  }
  if (head === "assign" && method === "POST") {
    if (!user.caps.assign) return json({ error: "You cannot assign" }, 403);
    const body = await readJson(req);
    const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
    const result = await confirmAssignment(ids, body.engineerId ? String(body.engineerId) : null, body.reason ? String(body.reason) : null, { role: user.role, stateIds: user.stateIds });
    if (result.updated === 0 && result.skipped.length && result.skipped.every((row) => row.reason === "Outside your state")) {
      return json({ error: "This complaint is outside your state", skipped: result.skipped }, 403);
    }
    return json(result);
  }
  if (head === "engineers" && method === "POST" && id === "users") {
    if (!admin(user)) return json({ error: "Admins only" }, 403);
    const body = await readJson(req);
    const lines = String(body.csv ?? "").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
    const header = lines.shift()?.split(",").map((cell) => cell.trim().toLowerCase()) ?? [];
    let linked = 0;
    for (const line of lines) {
      const cells = line.split(",").map((cell) => cell.trim());
      const row: Record<string, string> = {};
      header.forEach((key, index) => { row[key] = cells[index] ?? ""; });
      const email = (row.email || "").toLowerCase();
      if (!email || !row.name) continue;
      const engineer = await prisma.engineer.findFirst({
        where: { OR: [{ phone: row.phone || "none" }, { name: { equals: row.name, mode: "insensitive" } }], active: true },
      });
      if (!engineer) continue;
      const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { engineerId: engineer.id }] } });
      if (existing) {
        if (!existing.engineerId) await prisma.user.update({ where: { id: existing.id }, data: { engineerId: engineer.id, role: "TECHNICIAN" } });
        linked += 1;
        continue;
      }
      const { randomBytes } = await import("crypto");
      const password = `Ow${randomBytes(9).toString("base64url")}A1`;
      await prisma.user.create({
        data: {
          name: row.name,
          email,
          role: "TECHNICIAN",
          phone: row.phone || engineer.phone,
          engineerId: engineer.id,
          passwordHash: await bcrypt.hash(password, 10),
          mustChangePassword: true,
          memberships: { create: [{ companyId: engineer.companyId }] },
        },
      });
      linked += 1;
    }
    return json({ linked });
  }
  if (head === "engineers" && method === "POST" && id === "signature") {
    if (!admin(user)) return json({ error: "Admins only" }, 403);
    const form = await req.formData();
    const engineerId = String(form.get("engineerId") ?? "");
    const file = form.get("file");
    if (!(file instanceof File) || !engineerId) return json({ error: "Choose a signature" }, 400);
    const { saveObject } = await import("./storage");
    const saved = await saveObject(`signatures/${engineerId}`, Buffer.from(await file.arrayBuffer()), file.type || "image/png");
    await prisma.engineer.update({ where: { id: engineerId }, data: { signaturePath: saved } });
    return json({ ok: true, path: saved });
  }
  if (head === "engineers" && method === "POST" && id && extraState(url)) {
    if (!admin(user)) return json({ error: "Admins only" }, 403);
    const body = await readJson(req);
    if (url.searchParams.get("action") === "reassign-open") return json(await reassignOpenComplaints(id));
    return json(await changeEngineerState(id, String(body.stateId), Array.isArray(body.districtIds) ? body.districtIds.map(String) : [], body.note ? String(body.note) : null));
  }
  if (head === "leave" && method === "GET") {
    const rows = await prisma.leaveRequest.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { engineer: { select: { name: true } } } });
    return json({ rows });
  }
  if (head === "leave" && method === "POST") {
    const body = await readJson(req);
    if (body.id && user.caps.assign) {
      await prisma.leaveRequest.update({ where: { id: String(body.id) }, data: { status: body.status === "REJECTED" ? "REJECTED" : "APPROVED", decidedById: user.id, decidedAt: new Date() } });
      return json({ ok: true });
    }
    if (!user.engineerId && !admin(user)) return json({ error: "Technicians request leave" }, 403);
    const row = await prisma.leaveRequest.create({
      data: { engineerId: String(body.engineerId || user.engineerId), from: new Date(body.from), to: new Date(body.to), reason: String(body.reason ?? "").slice(0, 240) },
    });
    return json({ row });
  }
  if (head === "expenses" && method === "GET") {
    const rows = await prisma.expenseClaim.findMany({ orderBy: { at: "desc" }, take: 50, include: { engineer: { select: { name: true } } } });
    const summary = await prisma.expenseClaim.groupBy({ by: ["type"], _sum: { amount: true } });
    return json({ rows, summary });
  }
  if (head === "expenses" && method === "POST" && id === "bill") {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "Choose a bill photo" }, 400);
    const { saveObject } = await import("./storage");
    const saved = await saveObject(`expenses/${user.id}-${Date.now()}`, Buffer.from(await file.arrayBuffer()), file.type || "image/jpeg");
    return json({ path: saved });
  }
  if (head === "expenses" && method === "POST") {
    const body = await readJson(req);
    if (body.id && user.caps.assign) {
      await prisma.expenseClaim.update({ where: { id: String(body.id) }, data: { status: body.status === "REJECTED" ? "REJECTED" : "APPROVED" } });
      return json({ ok: true });
    }
    const row = await prisma.expenseClaim.create({
      data: {
        engineerId: String(body.engineerId || user.engineerId),
        complaintId: body.complaintId ? String(body.complaintId) : null,
        type: String(body.type ?? "TA"),
        amount: Number(body.amount) || 0,
        detail: body.detail ? String(body.detail) : null,
        billPath: body.billPath ? String(body.billPath) : null,
      },
    });
    return json({ row });
  }
  if (head === "contracts" && method === "GET") {
    const today = new Date();
    const soon = new Date(Date.now() + 30 * 86400000);
    const rows = await prisma.serviceContract.findMany({ where: { end: { lte: soon } }, orderBy: { end: "asc" }, take: 50 });
    return json({ rows, due: rows.filter((row) => row.end >= today).length });
  }
  if (head === "contracts" && method === "POST") {
    if (!admin(user)) return json({ error: "Admins only" }, 403);
    const body = await readJson(req);
    const row = await prisma.serviceContract.create({
      data: { companyId: String(body.companyId), customerId: body.customerId ? String(body.customerId) : null, productName: body.productName ? String(body.productName) : null, start: new Date(body.start), end: new Date(body.end) },
    });
    return json({ row });
  }
  if (head === "settings-extra" && method === "GET") {
    if (!user.caps.settings) return json({ error: "Admins only" }, 403);
    return json({ settings: await allSettings() });
  }
  if (head === "settings-extra" && method === "POST") {
    if (!user.caps.settings) return json({ error: "Admins only" }, 403);
    const body = await readJson(req);
    await saveSetting(String(body.key), String(body.value ?? ""));
    return json({ ok: true });
  }
  if (head === "brands" && method === "POST" && id === "merge") {
    if (!admin(user)) return json({ error: "Admins only" }, 403);
    return json(await mergeKnownBrands());
  }
  if (head === "repeats" && method === "GET") {
    if (!admin(user)) return json({ error: "Admins only" }, 403);
    return json(await repeatProgress());
  }
  if (head === "repeats" && method === "POST" && id === "rebuild") {
    if (!admin(user)) return json({ error: "Admins only" }, 403);
    return json(await startRepeatRebuild());
  }
  if (head === "users-import" && method === "POST") {
    if (!admin(user)) return json({ error: "Admins only" }, 403);
    const body = await readJson(req);
    return json(await importUsers(String(body.csv ?? "")));
  }
  return null;
}

function extraState(url: URL) {
  return url.searchParams.get("action") === "state" || url.searchParams.get("action") === "reassign-open";
}

async function importUsers(csv: string) {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const header = lines.shift()?.split(",").map((cell) => cell.trim().toLowerCase()) ?? [];
  let created = 0;
  for (const line of lines) {
    const cells = line.split(",").map((cell) => cell.trim());
    const row: Record<string, string> = {};
    header.forEach((key, index) => { row[key] = cells[index] ?? ""; });
    if (!row.email || !row.name || !row.role) continue;
    const email = row.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    const role = mapRole(row.role);
    const { randomBytes } = await import("crypto");
    const password = `Ow${randomBytes(9).toString("base64url")}A1`;
    const user = existing ?? await prisma.user.create({
      data: { name: row.name, email, role, passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true },
    });
    if (!existing) {
      created += 1;
      const { randomBytes, createHash } = await import("crypto");
      const token = randomBytes(24).toString("hex");
      await prisma.user.update({ where: { id: user.id }, data: { resetTokenHash: createHash("sha256").update(token).digest("hex"), resetExpires: new Date(Date.now() + 30 * 60 * 1000) } });
      const { sendMail } = await import("./mail");
      const { publicOrigin } = await import("@/lib/origin");
      await sendMail(email, "Set your Oswal Service password", `Open this link within 30 minutes:\n${publicOrigin()}/reset?token=${token}\n`);
    }
    if (row.company) {
      const company = await prisma.company.findFirst({ where: { OR: [{ code: row.company }, { shortName: row.company }] } });
      if (company) await prisma.userCompany.upsert({ where: { userId_companyId: { userId: user.id, companyId: company.id } }, create: { userId: user.id, companyId: company.id }, update: {} });
    }
  }
  return { created, emailed: created };
}

function mapRole(raw: string) {
  const text = raw.toLowerCase();
  if (text.includes("clos")) return "CALL_CLOSER";
  if (text.includes("exec")) return "AREA_MANAGER";
  if (text.includes("state")) return "STATE_HEAD";
  if (text.includes("centre") || text.includes("center")) return "CALL_CENTRE";
  if (text.includes("tech")) return "TECHNICIAN";
  if (text.includes("oem")) return "OEM_PARTNER";
  if (text.includes("admin")) return "ADMIN";
  return raw.toUpperCase().replace(/\s+/g, "_");
}

const KNOWN_BRANDS = ["oswal", "crompton", "kirloskar", "cri", "texmo", "lubi", "shakti", "ksb", "himalayan solar ltd.", "alpex solar ltd."];

async function mergeKnownBrands() {
  const brands = await prisma.brand.findMany({ orderBy: { id: "asc" } });
  let merged = 0;
  const groups = new Map<string, typeof brands>();
  for (const brand of brands) {
    const key = `${brand.companyId}:${brand.name.trim().toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), brand]);
  }
  for (const [key, rows] of groups) {
    if (rows.length < 2 || !KNOWN_BRANDS.includes(key.split(":").slice(1).join(":"))) continue;
    const [keep, ...rest] = rows;
    for (const old of rest) {
      await prisma.complaint.updateMany({ where: { brandId: old.id }, data: { brandId: keep.id, brandName: keep.name } });
      await prisma.userBrand.updateMany({ where: { brandId: old.id }, data: { brandId: keep.id } }).catch(() => null);
      await prisma.brand.update({ where: { id: old.id }, data: { active: false, name: `${old.name} (merged ${old.id.slice(-4)})` } });
      merged += 1;
    }
  }
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Brand_company_name_ci" ON "Brand" ("companyId", lower("name")) WHERE active = true`);
  return { merged };
}

