import { loadObject, saveObject, signedObjectUrl } from "@/server/storage";
import { getScope, rejectTemporaryPassword } from "@/server/auth";
import { fail, json, readJson } from "@/server/http";
import { prisma, getVersion } from "@/server/db";
import { createComplaint, updateComplaint, bulkUpdate, getComplaint } from "@/server/complaints";
import { suggestTechnicians } from "@/server/assignment";
import { listMaster, masterDef, masterOptions, saveMaster, deleteMaster } from "@/server/masters";
import { previewImport, commitImport } from "@/server/importer";
import { enqueueExport } from "@/server/exports";
import { filtersFromRecord } from "@/server/scope";
import { listComplaints } from "@/server/query";
import { runEscalation, runSummary } from "@/server/jobs";
import { classifyDuplicates } from "@/lib/duplicates";
import { findCustomer, loadCustomerHistory, mergeCustomers } from "@/server/link";
import { loadScorecards, scorecardPdf, scorecardWorkbook } from "@/server/scorecard";
import { askTickets, bookingHint, dailyAiSummary, fixHints, summariseComplaint } from "@/server/ai";
import { storeAudio, transcribe } from "@/server/speech";
import { DEFAULT_SLABS, DEFAULT_WEIGHTS, incentiveFor, performanceScore } from "@/lib/phase3";
import { issueReportKey } from "@/lib/report-key";
import { normalizePhone, displayPhone } from "@/lib/mask";
import { ACTIVE_STATUSES } from "@/lib/labels";

async function actor() {
  const { user, scope } = await getScope();
  if (!user) return null;
  return { user, scope };
}

export async function GET(req: Request, context: { params: Promise<{ slug: string[] }> }) {
  try {
    const { slug } = await context.params;
    return await route("GET", slug, req);
  } catch (error) {
    return fail(error);
  }
}
export async function POST(req: Request, context: { params: Promise<{ slug: string[] }> }) {
  try {
    const { slug } = await context.params;
    return await route("POST", slug, req);
  } catch (error) {
    return fail(error);
  }
}
export async function PATCH(req: Request, context: { params: Promise<{ slug: string[] }> }) {
  try {
    const { slug } = await context.params;
    return await route("PATCH", slug, req);
  } catch (error) {
    return fail(error);
  }
}
export async function DELETE(req: Request, context: { params: Promise<{ slug: string[] }> }) {
  try {
    const { slug } = await context.params;
    return await route("DELETE", slug, req);
  } catch (error) {
    return fail(error);
  }
}

async function route(method: string, slug: string[], req: Request) {
  const url = new URL(req.url);
  const session = await actor();
  if (!session) return json({ error: "Sign in" }, 401);
  rejectTemporaryPassword(session.user);
  const { user, scope } = session;
  const [head, id, extra] = slug;

  if (method === "GET" && head === "live") return json({ version: await getVersion() });

  if (method === "GET" && head === "performance") {
    const engineers = await prisma.engineer.findMany({ where: { active: true }, orderBy: { name: "asc" }, take: 200 });
    const rows = [];
    for (const engineer of engineers) {
      const [assigned, closures, repeats, reopened, proofOk, feedback] = await Promise.all([
        prisma.complaint.count({ where: { engineerId: engineer.id, excludeFromMis: false } }),
        prisma.complaint.count({ where: { engineerId: engineer.id, status: { in: ["CLOSED", "HAPPY_CALLING"] }, excludeFromMis: false } }),
        prisma.complaint.count({ where: { engineerId: engineer.id, repeatWindow: 30, excludeFromMis: false } }),
        prisma.complaint.count({ where: { engineerId: engineer.id, repeatWindow: 30, excludeFromMis: false, closedAt: { not: null } } }),
        prisma.complaint.count({ where: { engineerId: engineer.id, status: { in: ["CLOSED", "HAPPY_CALLING"] }, gpsFar: false, feedbackPending: false } }),
        prisma.complaint.aggregate({ where: { engineerId: engineer.id, happyRating: { not: null } }, _avg: { happyRating: true } }),
      ]);
      const scored = performanceScore({
        closures, assigned, tatHours: null, slaHours: 48, repeats, feedback: feedback._avg.happyRating, proofOk, closed: closures, reopened,
      });
      rows.push({ name: engineer.name, closures, score: scored.score, incentive: incentiveFor(scored.score, DEFAULT_SLABS), ...scored.parts });
    }
    rows.sort((a, b) => b.score - a.score);
    return json({ rows, weights: DEFAULT_WEIGHTS, slabs: DEFAULT_SLABS });
  }

  if (method === "GET" && head === "proof") return json({ rules: await prisma.proofRule.findMany() });
  if (method === "POST" && head === "proof") {
    if (!user.caps.settings) return json({ error: "Admins only" }, 403);
    const body = await readJson(req);
    const saved = await prisma.proofRule.upsert({
      where: { callType: String(body.callType) },
      create: { callType: String(body.callType), requirePhoto: Boolean(body.requirePhoto), requireIdentity: Boolean(body.requireIdentity), requireGps: Boolean(body.requireGps), maxKm: Number(body.maxKm ?? 15) },
      update: { requirePhoto: Boolean(body.requirePhoto), requireIdentity: Boolean(body.requireIdentity), requireGps: Boolean(body.requireGps), maxKm: Number(body.maxKm ?? 15) },
    });
    return json(saved);
  }

  if (head === "report-keys" && !user.caps.security) return json({ error: "Admins only" }, 403);
  if (method === "GET" && head === "report-keys") {
    const keys = await prisma.reportKey.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
    return json({ keys });
  }
  if (method === "POST" && head === "report-keys") {
    const body = await readJson(req);
    const issued = issueReportKey();
    const row = await prisma.reportKey.create({ data: { name: String(body.name || "Report"), keyHash: issued.hash, prefix: issued.prefix } });
    return json({ key: issued.key, row });
  }
  if (method === "DELETE" && head === "report-keys") {
    const body = await readJson(req);
    await prisma.reportKey.update({ where: { id: String(body.id) }, data: { revokedAt: new Date() } });
    return json({ ok: true });
  }

  if (method === "GET" && head === "assist") return json(await dailyAiSummary());
  if (method === "POST" && head === "assist") {
    const body = await readJson(req);
    if (body.kind === "book") return json(await bookingHint(String(body.text ?? ""), body.phone ? String(body.phone) : null));
    if (body.kind === "fix") return json(await fixHints(String(body.text ?? "")));
    if (body.kind === "ask") return json(await askTickets(String(body.text ?? "")));
    if (body.kind === "summary" && body.complaintId) return json(await summariseComplaint(String(body.complaintId)));
    return json(await dailyAiSummary());
  }
  if (method === "POST" && head === "voice") {
    const body = await readJson(req);
    const lang = body.lang === "hi" ? "hi" : "en";
    const file = await storeAudio(String(body.complaintId), String(body.audio ?? ""));
    const speech = await transcribe(lang);
    const note = await prisma.voiceNote.create({
      data: { complaintId: String(body.complaintId), actorId: user.id, lang, path: file, transcript: speech.text, provider: speech.provider },
    });
    await prisma.complaintEvent.create({
      data: { complaintId: note.complaintId, actorId: user.id, actorName: user.name, type: "NOTE", message: `Voice note (${lang}): ${speech.text}` },
    });
    return json(note);
  }

  if (method === "GET" && head === "map") {
    const company = scope === "all" ? {} : { companyId: scope };
    const [complaints, engineers] = await Promise.all([
      prisma.complaint.findMany({
        where: { ...company, status: { in: ["OPEN", "ASSIGNED", "REASSIGNED", "PENDING"] }, lat: { not: null }, lng: { not: null }, excludeFromMis: false },
        take: 400,
        select: { id: true, ticketNo: true, status: true, lat: true, lng: true, bookDate: true, districtName: true, customerName: true },
      }),
      prisma.engineer.findMany({
        where: { ...company, active: true },
        take: 200,
        select: { id: true, name: true, homeLat: true, homeLng: true, phone: true, locations: { orderBy: { at: "desc" }, take: 1 } },
      }),
    ]);
    return json({
      provider: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || process.env.GOOGLE_MAPS_KEY ? "google" : "osm",
      complaints,
      engineers: engineers.map((engineer) => ({
        id: engineer.id,
        name: engineer.name,
        phone: engineer.phone,
        lat: engineer.locations[0]?.lat ?? engineer.homeLat,
        lng: engineer.locations[0]?.lng ?? engineer.homeLng,
      })).filter((engineer) => engineer.lat != null && engineer.lng != null),
    });
  }

  if (head === "scorecards" && method === "GET") {
    if (!user.caps.report) return json({ error: "Reports only" }, 403);
    const data = await loadScorecards(user, scope);
    const format = url.searchParams.get("format");
    if (format === "pdf") {
      const pdf = scorecardPdf(data);
      return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=scorecards.pdf" } });
    }
    if (format === "xlsx") {
      const file = await scorecardWorkbook(data);
      return new Response(file, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": "attachment; filename=scorecards.xlsx" } });
    }
    return json(data);
  }

  if (method === "GET" && head === "search") {
    const q = url.searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return json({ complaints: [], customers: [], engineers: [] });
    const companyIds = scope === "all" ? user.companyIds : [scope];
    const companyWhere = user.role === "ADMIN" && scope === "all" ? {} : { companyId: { in: companyIds.length ? companyIds : ["__none__"] } };
    const [complaints, customers, engineers] = await Promise.all([
      listComplaints(user, scope, { q, pageSize: 8 }),
      prisma.customer.findMany({
        where: { mergedIntoId: null, ...companyWhere, OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] },
        take: 6,
        select: { id: true, name: true, phone: true, companyId: true, district: { select: { name: true } } },
      }),
      prisma.engineer.findMany({
        where: { ...companyWhere, active: true, OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] },
        take: 6,
        select: { id: true, name: true, phone: true, companyId: true },
      }),
    ]);
    const mask = user.role === "TECHNICIAN";
    return json({
      complaints: complaints.rows,
      customers: customers.map((row) => ({ ...row, phone: displayPhone(row.phone, mask), districtName: row.district?.name ?? "" })),
      engineers,
    });
  }

  if (method === "GET" && head === "lookup") {
    const phone = normalizePhone(url.searchParams.get("phone"));
    const serial = url.searchParams.get("serial")?.trim() || null;
    const companyId = url.searchParams.get("companyId") || (scope !== "all" ? scope : user.companyIds[0]);
    const or = [];
    if (phone.length >= 8) or.push({ phone });
    if (serial) or.push({ serialNo: serial });
    const rows = or.length
      ? await prisma.complaint.findMany({
          where: { OR: or },
          orderBy: { bookDate: "desc" },
          take: 12,
          select: { id: true, ticketNo: true, status: true, bookDate: true, closedAt: true, cancelledAt: true, companyId: true, phone: true, serialNo: true, customerId: true, customerName: true },
        })
      : [];
    const customers = phone.length >= 8
      ? await prisma.customer.findMany({ where: { phone, mergedIntoId: null }, take: 4, include: { state: true, district: true, area: true, company: true } })
      : [];
    const duplicates = classifyDuplicates(rows, { phone, serialNo: serial, companyId: companyId ?? "" });
    const history = phone.length >= 10 ? await loadCustomerHistory(phone) : null;
    return json({ customers, duplicates, history });
  }

  if (method === "POST" && head === "customers" && id === "merge") {
    if (user.role !== "ADMIN") return json({ error: "Only an admin can merge customers" }, 403);
    const body = await readJson(req);
    let dropId = String(body.dropId ?? "");
    if (!dropId && body.phone) {
      const found = await findCustomer(prisma, { phone: String(body.phone), name: String(body.name ?? "") });
      dropId = found?.customer.id ?? "";
    }
    return json(await mergeCustomers(user, String(body.keepId ?? ""), dropId));
  }

  if (method === "POST" && head === "assets" && id) {
    if (user.role !== "ADMIN" && !user.caps.masterWrite) return json({ error: "You cannot update this asset" }, 403);
    const body = await readJson(req);
    const warrantyUntil = body.warrantyUntil ? new Date(String(body.warrantyUntil)) : null;
    const amcUntil = body.amcUntil ? new Date(String(body.amcUntil)) : null;
    const asset = await prisma.asset.update({
      where: { id },
      data: {
        warrantyUntil: body.warrantyUntil === "" ? null : warrantyUntil,
        amcUntil: body.amcUntil === "" ? null : amcUntil,
      },
    });
    return json({ id: asset.id });
  }

  if (method === "GET" && head === "suggest") {
    const product = url.searchParams.get("productId") ? await prisma.product.findUnique({ where: { id: url.searchParams.get("productId")! } }) : null;
    const ranked = await suggestTechnicians({
      companyId: url.searchParams.get("companyId") || (scope !== "all" ? scope : ""),
      pincode: url.searchParams.get("pincode"),
      districtId: url.searchParams.get("districtId"),
      stateId: url.searchParams.get("stateId"),
      productType: product?.type,
      callType: url.searchParams.get("callType"),
    });
    return json({ suggestions: ranked });
  }

  if (method === "GET" && head === "options") {
    const companyIds = user.role === "ADMIN" && scope === "all" ? undefined : scope === "all" ? user.companyIds : [scope];
    const companyFilter = companyIds ? { companyId: { in: companyIds } } : {};
    const [companies, states, districts, areas, pincodes, categories, products, engineers, brands, issues, problems, solutions, checks, holds] = await Promise.all([
      prisma.company.findMany({ where: user.role === "ADMIN" ? {} : { id: { in: user.companyIds } }, orderBy: { code: "asc" } }),
      prisma.state.findMany({ orderBy: { name: "asc" } }),
      prisma.district.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, stateId: true } }),
      prisma.area.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, districtId: true } }),
      prisma.pincode.findMany({ select: { code: true, districtId: true, areaId: true } }),
      prisma.category.findMany({ orderBy: { name: "asc" } }),
      prisma.product.findMany({ where: { active: true, ...companyFilter }, orderBy: { name: "asc" } }),
      prisma.engineer.findMany({ where: { active: true, ...companyFilter }, orderBy: { name: "asc" } }),
      prisma.brand.findMany({ where: companyFilter, orderBy: { name: "asc" } }),
      prisma.complaintIssue.findMany({ orderBy: { name: "asc" } }),
      prisma.actualProblem.findMany({ orderBy: { name: "asc" } }),
      prisma.actualSolution.findMany({ orderBy: { name: "asc" } }),
      prisma.checkItem.findMany({ orderBy: { sort: "asc" } }),
      prisma.holdStatus.findMany({ orderBy: { name: "asc" } }),
    ]);
    return json({ companies, states, districts, areas, pincodes, categories, products, engineers, brands, issues, problems, solutions, checks, holds });
  }

  if (method === "GET" && head === "views") {
    const views = await prisma.savedView.findMany({ where: { userId: user.id, entity: "complaints" }, orderBy: { name: "asc" } });
    return json({ views });
  }
  if (method === "POST" && head === "views") {
    const body = await readJson(req);
    const view = await prisma.savedView.upsert({
      where: { userId_entity_name: { userId: user.id, entity: "complaints", name: String(body.name).slice(0, 60) } },
      create: { userId: user.id, entity: "complaints", name: String(body.name).slice(0, 60), filters: JSON.stringify(body.filters ?? {}) },
      update: { filters: JSON.stringify(body.filters ?? {}) },
    });
    return json({ view });
  }
  if (method === "DELETE" && head === "views" && id) {
    await prisma.savedView.deleteMany({ where: { id, userId: user.id } });
    return json({ ok: true });
  }

  if (head === "complaints" && method === "GET" && !id) {
    return json(await listComplaints(user, scope, { ...filtersFromRecord(Object.fromEntries(url.searchParams.entries())), cursor: url.searchParams.get("cursor") ?? undefined }));
  }
  if (head === "customers" && method === "GET" && !id) {
    const cursor = url.searchParams.get("cursor");
    const rows = await prisma.customer.findMany({
      where: {
        mergedIntoId: null,
        ...(cursor ? { id: { gt: cursor } } : {}),
        ...(scope === "all" || user.role === "ADMIN" ? {} : { companyId: scope === "all" ? undefined : scope }),
      },
      orderBy: { id: "asc" },
      take: 50,
      select: { id: true, name: true, phone: true },
    });
    return json({ rows, nextCursor: rows.length === 50 ? rows[rows.length - 1].id : null });
  }
  if (head === "complaints" && method === "POST" && !id) return json(await createComplaint(user, await readJson(req)));
  if (head === "complaints" && method === "POST" && id === "bulk") return json(await bulkUpdate(user, scope, await readJson(req)));
  if (head === "complaints" && id && method === "PATCH") return json(await updateComplaint(user, scope, id, await readJson(req)));
  if (head === "complaints" && id && method === "GET") {
    const row = await getComplaint(user, scope, id);
    return row ? json(row) : json({ error: "Not found" }, 404);
  }

  if (method === "POST" && head === "reference") {
    if (!user.caps.masterWrite) return json({ error: "Admins only" }, 403);
    const { loadReference } = await import("@/server/load-reference.mjs");
    return json(await loadReference(prisma));
  }
  if (method === "POST" && head === "pincodes-csv") {
    if (!user.caps.masterWrite) return json({ error: "Admins only" }, 403);
    const body = await readJson(req);
    const { parsePincodeCsv } = await import("@/data/reference.mjs");
    const { importPincodes } = await import("@/server/load-reference.mjs");
    return json(await importPincodes(prisma, parsePincodeCsv(String(body.csv ?? ""))));
  }

  if (head === "masters" && id) {
    const def = masterDef(id);
    if (!def) return json({ error: "Unknown master" }, 404);
    if (!user.caps.masterView && !user.caps.masterWrite) return json({ error: "No access" }, 403);
    if (method === "GET") {
      const page = Number(url.searchParams.get("page") ?? 1);
      const [list, options] = await Promise.all([
        listMaster(def, url.searchParams.get("q") ?? undefined, page, scope, url.searchParams.get("cursor")),
        masterOptions(),
      ]);
      return json({ ...list, options, canWrite: user.caps.masterWrite });
    }
    if (method === "POST") return json(await saveMaster(user, def, await readJson(req)));
    if (method === "PATCH") {
      const body = await readJson(req);
      return json(await saveMaster(user, def, body, String(body.id)));
    }
    if (method === "DELETE") return json(await deleteMaster(user, def, url.searchParams.get("id") || ""));
  }

  if (head === "import" && method === "POST" && !user.caps.security) return json({ error: "Admins only" }, 403);
  if (head === "import" && method === "POST" && id === "preview") {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "Choose a file" }, 400);
    const bytes = Buffer.from(await file.arrayBuffer());
    return json(await previewImport(file.name, bytes));
  }
  if (head === "import" && method === "POST" && id === "commit") return json(await commitImport(user, await readJson(req)));

  if (head === "exports" && method === "GET") {
    const jobs = await prisma.exportJob.findMany({ where: user.caps.security ? {} : { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 });
    return json({ jobs });
  }
  if (head === "exports" && method === "POST") {
    if (!user.caps.export) return json({ error: "You cannot export" }, 403);
    const body = await readJson(req);
    const job = await enqueueExport(user, scope, filtersFromRecord(body.filters ?? {}));
    return json({ job });
  }
  if (head === "exports" && id && extra === "file" && method === "GET") {
    const job = await prisma.exportJob.findUnique({ where: { id } });
    if (!job || !job.filePath || job.status !== "DONE") return json({ error: "Not ready" }, 404);
    if (job.userId !== user.id && !user.caps.security) return json({ error: "Not your export" }, 403);
    const signed = await signedObjectUrl(job.filePath, { filename: job.fileName ?? "export.csv", contentType: "text/csv" });
    if (signed) return Response.redirect(signed, 302);
    const bytes = await loadObject(job.filePath);
    return new Response(bytes, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${job.fileName ?? "export.csv"}"` } });
  }

  if (head === "attachments" && method === "POST") {
    const form = await req.formData();
    const file = form.get("file");
    const complaintId = String(form.get("complaintId") ?? "");
    if (!(file instanceof File)) return json({ error: "Choose a file" }, 400);
    if (file.size > 5_000_000) return json({ error: "Files must be under 5 MB" }, 400);
    const complaint = await getComplaint(user, scope, complaintId);
    if (!complaint) return json({ error: "Complaint not found" }, 404);
    const stored = `uploads/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "")}`;
    await saveObject(stored, Buffer.from(await file.arrayBuffer()), file.type || "application/octet-stream");
    const attachment = await prisma.attachment.create({
      data: { complaintId: complaint.id, fileName: file.name, mime: file.type, size: file.size, path: stored, uploadedBy: user.id },
    });
    await prisma.complaintEvent.create({ data: { complaintId: complaint.id, actorId: user.id, actorName: user.name, type: "ATTACHMENT", message: `Attached ${file.name}` } });
    return json({ attachment });
  }
  if (head === "attachments" && id && method === "GET") {
    const attachment = await prisma.attachment.findUnique({ where: { id }, include: { complaint: true } });
    if (!attachment) return json({ error: "Not found" }, 404);
    const { canSee } = await import("@/server/scope");
    if (!canSee(user, scope, attachment.complaint)) return json({ error: "Not found" }, 404);
    const key = attachment.path.includes("/") ? attachment.path : `uploads/${attachment.path}`;
    const signed = await signedObjectUrl(key, { filename: attachment.fileName, contentType: attachment.mime || "application/octet-stream" });
    if (signed) return Response.redirect(signed, 302);
    const bytes = await loadObject(key);
    return new Response(bytes, {
      headers: {
        "Content-Type": attachment.mime || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${attachment.fileName.replace(/"/g, "")}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  if (head === "settings" && method === "GET") {
    if (!user.caps.settings) return json({ error: "Admins only" }, 403);
    const [slas, rules, templates, webhooks, escalations, summary] = await Promise.all([
      prisma.slaPolicy.findMany({ include: { company: true }, orderBy: [{ companyId: "asc" }, { callType: "asc" }] }),
      prisma.rule.findMany({ orderBy: { name: "asc" } }),
      prisma.notificationTemplate.findMany({ orderBy: [{ event: "asc" }, { channel: "asc" }] }),
      prisma.webhookEndpoint.findMany({ orderBy: { url: "asc" } }),
      prisma.escalationLog.findMany({ orderBy: { at: "desc" }, take: 20 }),
      prisma.appSetting.findUnique({ where: { key: "lastSummary" } }),
    ]);
    return json({ slas, rules, templates, webhooks, escalations, summary: summary ? JSON.parse(summary.value) : null });
  }
  if (head === "settings" && method === "POST") {
    if (!user.caps.settings) return json({ error: "Admins only" }, 403);
    const body = await readJson(req);
    if (body.kind === "sla") {
      await prisma.slaPolicy.upsert({
        where: { companyId_callType: { companyId: body.companyId, callType: body.callType } },
        create: { companyId: body.companyId, callType: body.callType, hours: Number(body.hours) },
        update: { hours: Number(body.hours) },
      });
    } else if (body.kind === "rule") {
      await prisma.rule.create({ data: { name: body.name, companyId: body.companyId || null, definition: JSON.stringify(body.definition), active: true } });
    } else if (body.kind === "rule-delete") {
      await prisma.rule.delete({ where: { id: body.id } });
    } else if (body.kind === "template") {
      await prisma.notificationTemplate.update({ where: { id: body.id }, data: { body: body.body, active: Boolean(body.active) } });
    } else if (body.kind === "webhook") {
      await prisma.webhookEndpoint.create({ data: { url: body.url, secret: body.secret || null, events: body.events || "complaint.created,complaint.closed", companyId: body.companyId || null, active: true } });
    } else if (body.kind === "escalate") {
      return json(await runEscalation({ force: true, maxBatches: 10 }));
    } else if (body.kind === "summary") {
      return json(await runSummary());
    } else if (body.kind === "wa-template") {
      await prisma.notificationTemplate.upsert({
        where: { companyId_event_channel: { companyId: body.companyId, event: body.event, channel: "WHATSAPP" } },
        create: { companyId: body.companyId, event: body.event, channel: "WHATSAPP", body: body.body, active: true },
        update: { body: body.body, active: body.active !== false },
      });
    }
    return json({ ok: true });
  }

  if (head === "users" && method === "POST") {
    if (!user.caps.security) return json({ error: "Admins only" }, 403);
    const body = await readJson(req);
    const bcrypt = await import("bcryptjs");
    const created = await prisma.user.create({
      data: {
        name: body.name,
        email: String(body.email).toLowerCase(),
        passwordHash: await bcrypt.hash(String(body.password || "Welcome@123"), 8),
        role: body.role,
        phone: body.phone || null,
        memberships: { create: (body.companyIds ?? []).map((companyId: string) => ({ companyId })) },
        states: { create: (body.stateIds ?? []).map((stateId: string) => ({ stateId })) },
        districts: { create: (body.districtIds ?? []).map((districtId: string) => ({ districtId })) },
        brands: { create: (body.brandIds ?? []).map((brandId: string) => ({ brandId })) },
      },
    });
    return json({ id: created.id });
  }
  if (head === "users" && method === "PATCH" && id) {
    if (!user.caps.security) return json({ error: "Admins only" }, 403);
    const body = await readJson(req);
    await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { name: body.name, role: body.role, active: body.active !== false, phone: body.phone || null } }),
      prisma.userCompany.deleteMany({ where: { userId: id } }),
      prisma.userState.deleteMany({ where: { userId: id } }),
      prisma.userDistrict.deleteMany({ where: { userId: id } }),
      prisma.userBrand.deleteMany({ where: { userId: id } }),
      prisma.userCompany.createMany({ data: (body.companyIds ?? []).map((companyId: string) => ({ userId: id, companyId })) }),
      prisma.userState.createMany({ data: (body.stateIds ?? []).map((stateId: string) => ({ userId: id, stateId })) }),
      prisma.userDistrict.createMany({ data: (body.districtIds ?? []).map((districtId: string) => ({ userId: id, districtId })) }),
      prisma.userBrand.createMany({ data: (body.brandIds ?? []).map((brandId: string) => ({ userId: id, brandId })) }),
    ]);
    return json({ ok: true });
  }

  void ACTIVE_STATUSES;
  return json({ error: "Not found" }, 404);
}
