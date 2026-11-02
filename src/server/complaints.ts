import { z } from "zod";
import { prisma, bumpVersion } from "./db";
import { HttpError } from "./http";
import { nextTicketNo, rememberTicket } from "./ticket-seq";
import { canSee } from "./scope";
import { queueAssignment, suggestTechnicians } from "./assignment";
import { notifyComplaint, queueWebhook } from "./notify";
import { notifyWhatsAppEvent } from "./whatsapp";
import { bookingConflicts, type BookingRow } from "@/lib/duplicates";
import { ensureAsset, ensureCustomer, findCustomer, relinkAsset } from "./link";
import { resolveSerial, validateSerial, channelFor } from "@/lib/quality";
import { normalizePhone } from "@/lib/mask";
import { labelOf, STATUSES, DEFAULT_SLA_HOURS, ACTIVE_STATUSES, normalizeCustomerName } from "@/lib/labels";
import { assessSla } from "@/lib/sla";
import { loadRiskContext } from "./query";
import { displayPhone } from "@/lib/mask";
import { formatDay } from "@/lib/time";
import type { SessionUser } from "@/lib/types";
import { parseTicketNo } from "@/lib/ticket";
import { issueTrackToken } from "@/lib/report-key";
import { publicOrigin } from "@/lib/origin";

const active = new Set<string>(ACTIVE_STATUSES);

const bookSchema = z.object({
  companyId: z.string().min(1),
  customerName: z.string().trim().min(2).max(120),
  phone: z.string().min(8).max(20),
  altPhone: z.string().max(20).optional().nullable(),
  address: z.string().max(400).optional().nullable(),
  stateId: z.string().optional().nullable(),
  districtId: z.string().optional().nullable(),
  areaId: z.string().optional().nullable(),
  pincode: z.string().max(12).optional().nullable(),
  callType: z.enum(["BREAKDOWN", "INSTALLATION", "INSURANCE", "MOBILE_APP", "SCHEME"]),
  categoryId: z.string().optional().nullable(),
  productId: z.string().optional().nullable(),
  productDetails: z.string().max(240).optional().nullable(),
  serialNo: z.string().max(60).optional().nullable(),
  serialUnavailable: z.boolean().optional(),
  serialUnavailableReason: z.string().max(40).optional().nullable(),
  duplicateOverrideReason: z.string().max(240).optional().nullable(),
  natureId: z.string().optional().nullable(),
  natureText: z.string().max(240).optional().nullable(),
  source: z.string().max(40).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  scheduleDate: z.string().optional().nullable(),
  brandId: z.string().optional().nullable(),
  saralId: z.string().max(40).optional().nullable(),
  msedclConsumerNo: z.string().max(40).optional().nullable(),
  msedclSubdivision: z.string().max(80).optional().nullable(),
  schemeName: z.string().max(40).optional().nullable(),
  engineerId: z.string().optional().nullable(),
  assignMode: z.enum(["suggest", "manual", "none"]).optional(),
  acknowledgeDuplicate: z.boolean().optional(),
  callBy: z.string().max(80).optional().nullable(),
  email: z.string().max(120).optional().nullable(),
  purchaseDate: z.string().max(20).optional().nullable(),
  portal: z.string().max(80).optional().nullable(),
  subType: z.string().max(80).optional().nullable(),
  msedclRequestNo: z.string().max(40).optional().nullable(),
  msedclStatus: z.string().max(40).optional().nullable(),
  requestSubtype: z.string().max(80).optional().nullable(),
  msedclVideoUrl: z.string().max(400).optional().nullable(),
  tehsilId: z.string().optional().nullable(),
  cityId: z.string().optional().nullable(),
  idempotencyKey: z.string().max(80).optional().nullable(),
  version: z.number().optional(),
});

export type BookInput = z.infer<typeof bookSchema>;

function parseDeskDate(value: string | null) {
  if (!value) return null;
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (dmy) return new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), 4, 30));
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 4, 30));
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function clean(value?: string | null) {
  const text = value?.trim();
  return text ? text : null;
}

async function slaPlan(companyId: string, callType: string) {
  const policy = await prisma.slaPolicy.findUnique({ where: { companyId_callType: { companyId, callType } } });
  const hours = policy?.active === false ? DEFAULT_SLA_HOURS[callType] ?? 24 : policy?.hours ?? DEFAULT_SLA_HOURS[callType] ?? 24;
  const callback = policy?.callbackHours ?? 24;
  return { hours, callback };
}

export async function createComplaint(user: SessionUser | null, inputRaw: unknown, opts?: { publicForm?: boolean }) {
  const input = bookSchema.parse(inputRaw);
  try {
    input.customerName = normalizeCustomerName(input.customerName);
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : "Enter the customer's real name");
  }
  const override = clean(input.duplicateOverrideReason);
  const overrideOk = !input.acknowledgeDuplicate || (user && (user.role === "ADMIN" || user.role === "STATE_HEAD") && (["Different pump at same site", "Customer insists", "Previous ticket closed wrongly"].includes(override ?? "") || (override ?? "").startsWith("Other:")));
  if (input.acknowledgeDuplicate && !overrideOk) throw new HttpError(403, "Only an admin or state head can override, and the reason must be from the list");
  if (user && !user.caps.book && !opts?.publicForm) throw new HttpError(403, "You cannot book complaints");
  if (user && user.role !== "ADMIN" && !user.companyIds.includes(input.companyId)) throw new HttpError(403, "You cannot book for that company");
  const phone = normalizePhone(input.phone);
  if (!/^[6-9]\d{9}$/.test(phone)) throw new HttpError(400, "Enter a 10-digit mobile number starting with 6 to 9");
  if (input.idempotencyKey) {
    const existingKey = await prisma.complaint.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existingKey) return existingKey;
  }
  if (!input.natureId && !clean(input.natureText)) throw new HttpError(400, "Choose the nature of the complaint");

  const company = await prisma.company.findUnique({ where: { id: input.companyId } });
  if (!company) throw new HttpError(400, "Choose a company");

  let districtId = clean(input.districtId);
  let stateId = clean(input.stateId);
  let areaId = clean(input.areaId);
  const pincode = clean(input.pincode);
  if (pincode && !/^[1-9]\d{5}$/.test(pincode)) throw new HttpError(400, "Enter a 6-digit pincode");
  if (pincode && !districtId) {
    const pin = await prisma.pincode.findUnique({ where: { code: pincode } });
    if (pin) {
      districtId = pin.districtId;
      areaId = areaId ?? pin.areaId;
    }
  }
  if (districtId && !stateId) {
    const district = await prisma.district.findUnique({ where: { id: districtId } });
    stateId = district?.stateId ?? null;
  }
  if (!districtId || !stateId) throw new HttpError(400, "Add the district, or a pincode we already know");

  const [state, district, area, product, brand, nature, category] = await Promise.all([
    prisma.state.findUnique({ where: { id: stateId } }),
    prisma.district.findUnique({ where: { id: districtId } }),
    areaId ? prisma.area.findUnique({ where: { id: areaId } }) : null,
    input.productId ? prisma.product.findUnique({ where: { id: input.productId } }) : null,
    input.brandId ? prisma.brand.findUnique({ where: { id: input.brandId } }) : prisma.brand.findFirst({ where: { companyId: company.id, name: { equals: "Oswal", mode: "insensitive" } } }),
    input.natureId ? prisma.complaintIssue.findUnique({ where: { id: input.natureId } }) : null,
    input.categoryId ? prisma.category.findUnique({ where: { id: input.categoryId } }) : null,
  ]);
  if (!state || !district) throw new HttpError(400, "State or district was not found");
  if (category?.companyCode && category.companyCode !== company.code) throw new HttpError(400, "That product belongs to the other company");

  const serial = resolveSerial({ serial: input.serialNo, unavailable: input.serialUnavailable, reason: input.serialUnavailableReason });
  if (!serial.ok) throw new HttpError(400, serial.reason);
  const capacityLabel = product?.hpId ? (await prisma.hpCapacity.findUnique({ where: { id: product.hpId } }))?.label ?? null : null;
  const foundCustomer = await findCustomer(prisma, { phone, name: input.customerName, pincode, village: area?.name ?? null });
  const existingCustomer = foundCustomer?.customer ?? null;
  const or: { phone?: string; serialNorm?: string; customerId?: string }[] = [{ phone }];
  if (serial.serial) or.push({ serialNorm: serial.serial });
  if (existingCustomer) or.push({ customerId: existingCustomer.id });
  const existing = await prisma.complaint.findMany({
    where: { OR: or, excludeFromMis: false },
    orderBy: { bookDate: "desc" },
    take: 30,
    select: {
      id: true, ticketNo: true, status: true, bookDate: true, closedAt: true, cancelledAt: true,
      companyId: true, phone: true, serialNo: true, serialNorm: true, customerId: true, customerName: true,
      productId: true, districtId: true, capacityLabel: true, productDetails: true,
    },
  });
  const conflicts = bookingConflicts(existing as BookingRow[], {
    phone,
    serialNo: serial.serial,
    customerName: input.customerName,
    productId: product?.id,
    productDetails: clean(input.productDetails) ?? product?.name,
    capacityLabel,
    districtId,
    companyId: company.id,
  });
  const otherOwner = serial.serial
    ? await prisma.complaint.findFirst({
        where: { serialNorm: serial.serial, excludeFromMis: false, NOT: { phone } },
        select: { ticketNo: true, customerName: true },
      })
    : null;
  if ((conflicts.blocking.length || conflicts.sameDay.length || otherOwner) && !input.acknowledgeDuplicate) {
    const reason = otherOwner && !conflicts.reason
      ? `Serial ${serial.serial} is already linked to ${otherOwner.customerName} on ${otherOwner.ticketNo}.`
      : conflicts.reason ?? "A similar complaint already exists";
    throw new HttpError(409, reason, {
      duplicates: [...conflicts.blocking, ...conflicts.sameDay].map((row) => ({ ticketNo: row.ticketNo, status: row.status, basis: row.basis })),
      otherOwner,
      reason,
    });
  }

  const assignMode = input.assignMode ?? "none";
  let engineerId = clean(input.engineerId);
  let assignReason: string | null = null;
  if (assignMode === "none") engineerId = null;
  if (assignMode === "suggest" && !engineerId) {
    const ranked = await suggestTechnicians({
      companyId: company.id,
      pincode,
      districtId,
      stateId,
      productType: product?.type,
      callType: input.callType,
    });
    if (ranked[0] && ranked[0].score > 0) {
      engineerId = ranked[0].engineerId;
      assignReason = ranked[0].reason;
    }
  }
  const engineer = engineerId ? await prisma.engineer.findUnique({ where: { id: engineerId } }) : null;
  if (engineerId && (!engineer || engineer.companyId !== company.id)) throw new HttpError(400, "Choose a technician from this company");
  if (engineer && !assignReason) assignReason = assignMode === "manual" ? "Chosen by the desk" : "Selected technician";

  const plan = await slaPlan(company.id, input.callType);
  const hours = plan.hours;
  const bookDate = new Date();
  const scheduleDate = parseDeskDate(clean(input.scheduleDate));
  const source = opts?.publicForm ? (input.source === "QR" ? "QR" : input.source === "WHATSAPP" ? "WHATSAPP" : "WEB") : user?.role === "DEALER" ? "DEALER" : input.source || "CALL";
  const status = engineer ? "ASSIGNED" : "OPEN";
  const actorName = user?.name ?? (source === "QR" ? "QR link" : "Web form");

  const created = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`book:${phone}`}))`;
    if (serial.serial) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`serial:${serial.serial}`}))`;
    if (serial.serial && !input.acknowledgeDuplicate) {
      const openSame = await tx.complaint.findFirst({
        where: { serialNorm: serial.serial, callType: input.callType, status: { in: ["OPEN", "ASSIGNED", "REASSIGNED", "PENDING"] } },
        select: { ticketNo: true },
      });
      if (openSame) throw new HttpError(409, `Open ticket ${openSame.ticketNo} already covers this serial and call type`);
    }
    const ticketNo = await nextTicketNo(bookDate, tx);
    const party = await ensureCustomer(tx, {
      companyId: company.id,
      name: input.customerName,
      phone,
      altPhone: clean(input.altPhone),
      address: clean(input.address),
      stateId,
      districtId,
      areaId,
      pincode,
      village: area?.name ?? null,
      isTest: Boolean(user?.isTest),
    });
    const customer = party.customer;
    const asset = await ensureAsset(tx, {
      companyId: company.id,
      customerId: customer.id,
      name: input.customerName,
      phone,
      productId: product?.id,
      productName: clean(input.productDetails) ?? product?.name ?? null,
      modelName: product?.name ?? clean(input.productDetails),
      serialNorm: serial.serial,
      capacityLabel,
    });
    const complaint = await tx.complaint.create({
      data: {
        ticketNo,
        trackToken: issueTrackToken(),
        companyId: company.id,
        bookDate,
        scheduleDate,
        customerId: customer.id,
        customerName: input.customerName,
        phone,
        altPhone: clean(input.altPhone),
        address: clean(input.address),
        stateId,
        districtId,
        areaId,
        stateName: state.name,
        districtName: district.name,
        areaName: area?.name,
        pincode,
        callType: input.callType,
        categoryId: category?.id ?? product?.categoryId,
        categoryName: category?.name,
        productId: product?.id,
        productDetails: clean(input.productDetails) ?? product?.name,
        serialNo: serial.serial,
        serialNorm: serial.serial,
        serialPending: serial.pending,
        serialUnavailableReason: serial.reason,
        capacityLabel,
        channel: channelFor(input.callType),
        excludeFromMis: Boolean(user?.isTest || customer.isTest),
        serialCustomerMismatch: Boolean(otherOwner),
        assetId: asset.id,
        duplicateOfTicket: conflicts.lead?.ticketNo ?? otherOwner?.ticketNo ?? null,
        duplicateOverrideReason: override,
        natureId: nature?.id,
        natureText: nature?.name ?? clean(input.natureText),
        source,
        callBy: clean(input.callBy) ?? actorName,
        priority: input.priority ?? "NORMAL",
        status,
        finalStatus: labelOf(STATUSES, status),
        engineerId: engineer?.id,
        assignedName: engineer?.name,
        assignedAt: engineer ? bookDate : null,
        brandId: brand?.id,
        brandName: brand?.name,
        saralId: clean(input.saralId),
        msedclConsumerNo: clean(input.msedclConsumerNo),
        msedclSubdivision: clean(input.msedclSubdivision),
        schemeName: clean(input.schemeName),
        email: clean(input.email),
        purchaseDate: parseDeskDate(clean(input.purchaseDate)),
        portal: clean(input.portal),
        subType: clean(input.subType),
        msedclRequestNo: clean(input.msedclRequestNo),
        msedclStatus: clean(input.msedclStatus),
        requestSubtype: clean(input.requestSubtype),
        msedclVideoUrl: clean(input.msedclVideoUrl),
        tehsilId: clean(input.tehsilId),
        cityId: clean(input.cityId),
        idempotencyKey: clean(input.idempotencyKey),
        qaFlag: Boolean(user?.isTest),
        slaDueAt: new Date(bookDate.getTime() + hours * 3600 * 1000),
        callbackDueAt: new Date(bookDate.getTime() + plan.callback * 3600 * 1000),
        slaHours: hours,
        repeatFlag: conflicts.blocking.length > 0 || Boolean(otherOwner),
        repeatReason: conflicts.reason,
        assignReason,
        createdById: user?.id,
      },
    });
    await relinkAsset(tx, asset.id);
    const linked = await tx.complaint.findUnique({ where: { id: complaint.id }, select: { repeatOfTicket: true, repeatWindow: true } });
    const repeatNote = linked?.repeatOfTicket
      ? ` · repeat of ${linked.repeatOfTicket}${linked.repeatWindow ? ` · repeat failure within ${linked.repeatWindow} days` : ""}`
      : "";
    await tx.complaintEvent.create({
      data: {
        complaintId: complaint.id,
        actorId: user?.id,
        actorName,
        type: "CREATED",
        message: `Booked ${ticketNo}${serial.pending ? " · serial pending" : ""}${engineer ? ` and assigned to ${engineer.name}` : ""}${repeatNote}${override ? ` · duplicate override: ${override}` : ""}`,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: user?.id,
        companyId: company.id,
        entity: "Complaint",
        entityId: complaint.id,
        action: "CREATE",
        summary: `Booked ${ticketNo}`,
        after: { ticketNo, status, phone },
      },
    });
    await bumpVersion(tx);
    return complaint;
  }, { timeout: 60000, maxWait: 20000 });
  if (!created.engineerId) await queueAssignment(created.id);

  await notifyComplaint({
    event: "BOOKING",
    companyId: company.id,
    companyName: company.shortName,
    complaintId: created.id,
    ticketNo: created.ticketNo,
    customerName: created.customerName,
    phone: created.phone,
    engineer: created.assignedName,
    scheduleDate: created.scheduleDate ? formatDay(created.scheduleDate) : null,
    status: created.status,
  });
  if (created.engineerId) {
    await notifyComplaint({
      event: "ASSIGNMENT",
      companyId: company.id,
      companyName: company.shortName,
      complaintId: created.id,
      ticketNo: created.ticketNo,
      customerName: created.customerName,
      phone: created.phone,
      engineer: created.assignedName,
      scheduleDate: created.scheduleDate ? formatDay(created.scheduleDate) : null,
      status: created.status,
    });
  }
  queueWebhook("complaint.created", { ticketNo: created.ticketNo, status: created.status, companyId: company.id, callType: created.callType }, company.id);
  const vars = {
    ticketNo: created.ticketNo,
    customerName: created.customerName,
    engineer: created.assignedName ?? "",
    engineerPhone: engineer?.phone ?? "",
    scheduleDate: created.scheduleDate ? formatDay(created.scheduleDate) : "soon",
    link: `${publicOrigin()}/track/${created.trackToken ?? created.ticketNo}`,
    otp: "",
  };
  await notifyWhatsAppEvent("REGISTERED", { phone: created.phone, companyId: company.id, complaintId: created.id, vars });
  if (created.engineerId) await notifyWhatsAppEvent("ASSIGNED", { phone: created.phone, companyId: company.id, complaintId: created.id, vars });
  return created;
}

const actionSchema = z.object({
  action: z.enum(["assign", "hold", "close", "happy", "cancel", "reopen", "schedule", "priority", "note", "payment", "video"]),
  engineerId: z.string().optional().nullable(),
  holdReason: z.string().max(240).optional().nullable(),
  problemId: z.string().optional().nullable(),
  problemText: z.string().max(240).optional().nullable(),
  solutionId: z.string().optional().nullable(),
  solutionText: z.string().max(240).optional().nullable(),
  rating: z.number().int().min(1).max(5).optional(),
  remarks: z.string().max(500).optional().nullable(),
  cancelReason: z.string().max(240).optional().nullable(),
  scheduleDate: z.string().optional().nullable(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  note: z.string().max(2000).optional().nullable(),
  checklist: z.array(z.object({ itemId: z.string(), checked: z.boolean() })).optional(),
  serialNo: z.string().max(60).optional().nullable(),
  missingSerialReason: z.string().max(240).optional().nullable(),
  nameplateCaptured: z.boolean().optional(),
  version: z.number().optional(),
  serviceCharge: z.number().optional().nullable(),
  spareCharge: z.number().optional().nullable(),
  paymentNote: z.string().max(240).optional().nullable(),
  msedclVideoUrl: z.string().max(400).optional().nullable(),
});

export async function getComplaint(user: SessionUser, scope: string, idOrTicket: string) {
  const row = await prisma.complaint.findFirst({
    where: idOrTicket.toUpperCase().startsWith("OPL")
      ? { ticketNo: idOrTicket.toUpperCase() }
      : { OR: [{ id: idOrTicket }, { ticketNo: idOrTicket }] },
    include: {
      events: { orderBy: { at: "desc" }, take: 200 },
      notes: { orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { name: true } } } },
      attachments: { orderBy: { createdAt: "desc" } },
      checks: { include: { item: true } },
      company: true,
      escalatedTo: { select: { name: true, role: true } },
    },
  });
  if (!row || !canSee(user, scope, row)) return null;
  const mask = user.role === "TECHNICIAN";
  const ctx = await loadRiskContext();
  const signal = assessSla({
    status: row.status,
    bookDate: row.bookDate,
    slaDueAt: row.slaDueAt,
    now: ctx.now,
    engineerOpen: row.engineerId ? ctx.loadCounts.get(row.engineerId) ?? 0 : 0,
    historicalHours: ctx.hist[row.callType] ?? null,
  });
  const family: { serialNorm?: string; productId?: string }[] = [];
  if (row.serialNorm) family.push({ serialNorm: row.serialNorm });
  else if (row.productId && row.customerId) family.push({ productId: row.productId });
  const related = family.length
    ? await prisma.complaint.findMany({
        where: { id: { not: row.id }, customerId: row.customerId ?? undefined, OR: family },
        orderBy: { bookDate: "desc" },
        take: 40,
        include: {
          events: { orderBy: { at: "asc" }, take: 30 },
          spares: { orderBy: { requestedAt: "asc" } },
        },
      })
    : [];
  const asset = row.assetId
    ? await prisma.asset.findUnique({ where: { id: row.assetId } })
    : null;
  return {
    ...row,
    phone: displayPhone(row.phone, mask),
    altPhone: mask ? null : row.altPhone,
    slaBreached: signal.breached,
    slaRisk: signal.risk,
    slaRiskReason: signal.reason,
    timeline: buildTimeline(row),
    asset,
    relatedTickets: related.map((item) => ({
      id: item.id,
      ticketNo: item.ticketNo,
      status: item.status,
      bookDate: item.bookDate,
      closedAt: item.closedAt,
      assignedName: item.assignedName,
      actualProblem: item.actualProblem,
      actualSolution: item.actualSolution,
      natureText: item.natureText,
      productDetails: item.productDetails,
      sameAsset: item.assetId != null && item.assetId === row.assetId,
      spares: item.spares.map((spare) => `${spare.partName} × ${spare.qty}`),
      events: item.events.map((event) => ({ at: event.at, type: event.type, message: event.message, actorName: event.actorName })),
    })),
  };
}

function buildTimeline(row: {
  bookDate: Date;
  callBy: string | null;
  assignedAt: Date | null;
  assignedName: string | null;
  closedAt: Date | null;
  actualProblem: string | null;
  actualSolution: string | null;
  happyAt: Date | null;
  happyRating: number | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  holdReason: string | null;
  status: string;
  events: { id: string; at: Date; type: string; message: string; actorName: string | null }[];
}) {
  const items: { at: string; type: string; message: string; actorName: string | null }[] = [];
  const has = (type: string) => row.events.some((event) => event.type === type);
  if (!has("CREATED")) items.push({ at: row.bookDate.toISOString(), type: "CREATED", message: `Booked by ${row.callBy ?? "desk"}`, actorName: row.callBy });
  if (row.assignedAt && !has("ASSIGNED") && !has("REASSIGNED")) {
    items.push({ at: row.assignedAt.toISOString(), type: "ASSIGNED", message: `Assigned to ${row.assignedName ?? "a technician"}`, actorName: null });
  }
  if (row.status === "PENDING" && row.holdReason) {
    items.push({ at: (row.assignedAt ?? row.bookDate).toISOString(), type: "HOLD", message: `On hold: ${row.holdReason}`, actorName: null });
  }
  if (row.closedAt && !has("CLOSED")) {
    items.push({
      at: row.closedAt.toISOString(),
      type: "CLOSED",
      message: `Closed. ${row.actualProblem ?? ""} ${row.actualSolution ?? ""}`.trim(),
      actorName: null,
    });
  }
  if (row.happyAt) items.push({ at: row.happyAt.toISOString(), type: "HAPPY", message: `Happy calling ${row.happyRating ?? ""}/5`, actorName: null });
  if (row.cancelledAt && !has("CANCELLED")) {
    items.push({ at: row.cancelledAt.toISOString(), type: "CANCELLED", message: row.cancelReason ?? "Cancelled", actorName: null });
  }
  for (const event of row.events) items.push({ at: event.at.toISOString(), type: event.type, message: event.message, actorName: event.actorName });
  return items.sort((a, b) => a.at.localeCompare(b.at));
}

export async function updateComplaint(user: SessionUser, scope: string, id: string, raw: unknown) {
  const input = actionSchema.parse(raw);
  const current = await prisma.complaint.findUnique({ where: { id }, include: { company: true } });
  if (!current || !canSee(user, scope, current)) throw new HttpError(404, "Complaint not found");
  if (input.version != null && input.version !== current.version) throw new HttpError(409, "This complaint was updated in another tab. Reload it.");
  const now = new Date();
  const data: Record<string, unknown> = {};
  let type = input.action.toUpperCase();
  let message = "";
  let notifyEvent: string | null = null;

  if (input.action === "note") {
    if (!user.caps.note) throw new HttpError(403, "You cannot add notes");
    const body = clean(input.note);
    if (!body) throw new HttpError(400, "Write a note");
    await prisma.$transaction(async (tx) => {
      await tx.complaintNote.create({ data: { complaintId: current.id, userId: user.id, body } });
      await tx.complaintEvent.create({ data: { complaintId: current.id, actorId: user.id, actorName: user.name, type: "NOTE", message: body } });
      await bumpVersion(tx);
    });
    return prisma.complaint.findUnique({ where: { id } });
  }

  if (input.action === "assign") {
    if (!user.caps.assign) throw new HttpError(403, "You cannot assign");
    const engineer = await prisma.engineer.findUnique({ where: { id: input.engineerId ?? "" } });
    if (!engineer || engineer.companyId !== current.companyId) throw new HttpError(400, "Choose a technician from this company");
    const reassigned = Boolean(current.engineerId);
    data.engineerId = engineer.id;
    data.assignedName = engineer.name;
    data.assignedAt = now;
    data.status = reassigned ? "REASSIGNED" : "ASSIGNED";
    data.finalStatus = labelOf(STATUSES, String(data.status));
    data.assignReason = "Reassigned from the desk";
    type = reassigned ? "REASSIGNED" : "ASSIGNED";
    message = `${reassigned ? "Re-assigned" : "Assigned"} to ${engineer.name}`;
    notifyEvent = "ASSIGNMENT";
  } else if (input.action === "hold") {
    if (!user.caps.hold) throw new HttpError(403, "You cannot hold a complaint");
    if (!active.has(current.status)) throw new HttpError(400, "Only a live complaint can be held");
    const reason = clean(input.holdReason);
    if (!reason) throw new HttpError(400, "A hold needs a reason");
    data.status = "PENDING";
    data.finalStatus = "Pending";
    data.holdReason = reason;
    message = `Held: ${reason}`;
  } else if (input.action === "close") {
    if (!user.caps.close) throw new HttpError(403, "You cannot close this complaint");
    if (!active.has(current.status)) throw new HttpError(400, "This complaint is not open");
    const problem = await textOrMaster(input.problemId, input.problemText, "problem");
    const solution = await textOrMaster(input.solutionId, input.solutionText, "solution");
    if (!problem.text || !solution.text) throw new HttpError(400, "Add the actual problem and the solution");
    let nextSerial = current.serialNorm;
    if (clean(input.serialNo)) {
      const checked = validateSerial(input.serialNo);
      if (!checked.ok) throw new HttpError(400, checked.reason);
      nextSerial = checked.serial;
      data.serialNo = checked.serial;
      data.serialNorm = checked.serial;
      data.serialPending = false;
      data.serialUnavailableReason = null;
      data.missingSerialReason = null;
    }
    const photo = Boolean(input.nameplateCaptured) || current.nameplatePhoto;
    if (!nextSerial && !photo) {
      const why = clean(input.missingSerialReason);
      if (!why) throw new HttpError(400, "Capture the serial (type, scan or a nameplate photo) or give a reason to close without it");
      data.missingSerialReason = why;
      data.serialPending = true;
    } else if (!nextSerial && photo) {
      data.nameplatePhoto = true;
      data.serialPending = true;
      data.missingSerialReason = clean(input.missingSerialReason) ?? "Nameplate photographed, number not entered";
    }
    if (input.nameplateCaptured) data.nameplatePhoto = true;
    data.status = "CLOSED";
    data.finalStatus = "Closed";
    data.closedAt = now;
    data.actualProblemId = problem.id;
    data.actualProblem = problem.text;
    data.actualSolutionId = solution.id;
    data.actualSolution = solution.text;
    data.slaBreached = current.slaDueAt ? current.slaDueAt <= now : false;
    data.feedbackPending = true;
    message = `Closed. ${problem.text} / ${solution.text}`;
    notifyEvent = "CLOSING";
  } else if (input.action === "happy") {
    if (!user.caps.happy) throw new HttpError(403, "Happy calling is for the call centre");
    if (current.status !== "CLOSED" && current.status !== "CLOSED_UNVERIFIED" && current.status !== "HAPPY_CALLING") throw new HttpError(400, "Close the complaint before happy calling");
    if (!input.rating) throw new HttpError(400, "Choose a rating from 1 to 5");
    data.status = "HAPPY_CALLING";
    data.finalStatus = "Happy Calling Done";
    data.happyRating = input.rating;
    data.happyRemarks = clean(input.remarks);
    data.happyAt = now;
    data.feedbackPending = false;
    message = `Happy calling done, ${input.rating}/5`;
    notifyEvent = "FEEDBACK";
  } else if (input.action === "cancel") {
    if (!user.caps.cancel) throw new HttpError(403, "You cannot cancel this complaint");
    if (current.status === "CANCELLED") throw new HttpError(400, "This complaint is already cancelled");
    if (current.status === "HAPPY_CALLING" && user.role !== "ADMIN") throw new HttpError(400, "Only an admin can cancel a complaint that is in happy calling");
    const reason = clean(input.cancelReason);
    if (!reason) throw new HttpError(400, "A cancellation needs a reason");
    data.status = "CANCELLED";
    data.finalStatus = "Cancelled";
    data.cancelReason = reason;
    data.cancelledAt = now;
    message = `Cancelled: ${reason}`;
  } else if (input.action === "reopen") {
    if (!user.caps.reopen) throw new HttpError(403, "You cannot reopen this complaint");
    if (current.status !== "CANCELLED" && current.status !== "PENDING") throw new HttpError(400, "Only pending or cancelled complaints reopen");
    data.status = current.engineerId ? "ASSIGNED" : "OPEN";
    data.finalStatus = labelOf(STATUSES, String(data.status));
    data.cancelReason = null;
    data.cancelledAt = null;
    message = "Reopened";
  } else if (input.action === "schedule") {
    if (!user.caps.assign && !user.caps.book) throw new HttpError(403, "You cannot schedule a visit");
    if (!input.scheduleDate) throw new HttpError(400, "Choose a schedule date");
    data.scheduleDate = new Date(input.scheduleDate);
    message = `Visit scheduled ${formatDay(input.scheduleDate)}`;
    notifyEvent = "VISIT";
    type = "VISIT";
    await notifyWhatsAppEvent("RESCHEDULED", {
      phone: current.phone,
      companyId: current.companyId,
      complaintId: current.id,
      vars: { ticketNo: current.ticketNo, customerName: current.customerName, scheduleDate: formatDay(input.scheduleDate), engineer: current.assignedName ?? "", engineerPhone: "", link: "", otp: "" },
    });
  } else if (input.action === "payment") {
    if (!user.caps.note && !user.caps.close) throw new HttpError(403, "You cannot record a payment");
    data.serviceCharge = input.serviceCharge ?? null;
    data.spareCharge = input.spareCharge ?? null;
    data.paymentNote = clean(input.paymentNote);
    data.paidAt = new Date();
    message = "Payment recorded";
    type = "NOTE";
  } else if (input.action === "video") {
    if (!user.caps.note && !user.caps.close) throw new HttpError(403, "You cannot add a video");
    data.msedclVideoUrl = clean(input.msedclVideoUrl);
    message = "MSEDCL video saved";
    type = "NOTE";
  } else if (input.action === "priority") {
    if (!user.caps.assign && user.role !== "ADMIN") throw new HttpError(403, "You cannot change priority");
    if (!input.priority) throw new HttpError(400, "Choose a priority");
    data.priority = input.priority;
    message = `Priority set to ${input.priority}`;
    type = "PRIORITY";
  }

  data.version = { increment: 1 };
  const updated = await prisma.$transaction(async (tx) => {
    const complaint = await tx.complaint.update({ where: { id: current.id }, data: data as never });
    await tx.complaintEvent.create({
      data: { complaintId: current.id, actorId: user.id, actorName: user.name, type, message },
    });
    if (input.action === "close" && input.checklist?.length) {
      await tx.complaintCheck.deleteMany({ where: { complaintId: current.id } });
      await tx.complaintCheck.createMany({
        data: input.checklist.filter((item) => item.checked).map((item) => ({ complaintId: current.id, itemId: item.itemId, checked: true })),
      });
    }
    let assetId = current.assetId;
    if (current.customerId && (input.action === "close" || data.serialNorm || !assetId)) {
      const moved = await ensureAsset(tx, {
        companyId: current.companyId,
        customerId: current.customerId,
        name: current.customerName,
        phone: current.phone,
        productId: current.productId,
        productName: current.productDetails,
        serialNorm: (data.serialNorm as string | undefined) ?? current.serialNorm,
        capacityLabel: current.capacityLabel,
      });
      if (moved.id !== current.assetId) {
        await tx.complaint.update({ where: { id: current.id }, data: { assetId: moved.id } });
        if (current.assetId) await relinkAsset(tx, current.assetId);
      }
      assetId = moved.id;
    }
    if (assetId && (input.action === "close" || data.serialNorm)) await relinkAsset(tx, assetId);
    await tx.auditLog.create({
      data: {
        userId: user.id,
        companyId: current.companyId,
        entity: "Complaint",
        entityId: current.id,
        action: type,
        summary: `${current.ticketNo}: ${message}`,
        before: { status: current.status },
        after: { status: complaint.status },
      },
    });
    await bumpVersion(tx);
    return complaint;
  });

  if (notifyEvent) {
    await notifyComplaint({
      event: notifyEvent,
      companyId: current.companyId,
      companyName: current.company.shortName,
      complaintId: current.id,
      ticketNo: current.ticketNo,
      customerName: current.customerName,
      phone: current.phone,
      engineer: updated.assignedName,
      scheduleDate: updated.scheduleDate ? formatDay(updated.scheduleDate) : null,
      status: updated.status,
    });
    if (notifyEvent === "CLOSING") {
      await notifyComplaint({
        event: "FEEDBACK",
        companyId: current.companyId,
        companyName: current.company.shortName,
        complaintId: current.id,
        ticketNo: current.ticketNo,
        customerName: current.customerName,
        phone: current.phone,
        status: updated.status,
      });
      await notifyWhatsAppEvent("FEEDBACK", {
        phone: current.phone,
        companyId: current.companyId,
        complaintId: current.id,
        vars: { ticketNo: current.ticketNo, customerName: current.customerName, engineer: updated.assignedName ?? "", engineerPhone: "", scheduleDate: "", link: "", otp: "" },
      });
    }
  }
  queueWebhook(
    updated.status === "CLOSED" ? "complaint.closed" : input.action === "assign" ? "complaint.assigned" : "complaint.status_changed",
    { ticketNo: updated.ticketNo, status: updated.status, companyId: updated.companyId },
    updated.companyId,
  );
  return updated;
}

async function textOrMaster(id: string | null | undefined, text: string | null | undefined, kind: "problem" | "solution") {
  const typed = clean(text);
  if (id) {
    const row = kind === "problem"
      ? await prisma.actualProblem.findUnique({ where: { id } })
      : await prisma.actualSolution.findUnique({ where: { id } });
    if (row) return { id: row.id, text: row.name };
  }
  return { id: null as string | null, text: typed };
}

const bulkSchema = z.object({
  ids: z.array(z.string()).min(1).max(50),
  action: z.enum(["assign", "hold", "cancel", "priority"]),
  engineerId: z.string().optional(),
  reason: z.string().max(240).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
});

export async function bulkUpdate(user: SessionUser, scope: string, raw: unknown) {
  const input = bulkSchema.parse(raw);
  const rows = await prisma.complaint.findMany({ where: { id: { in: input.ids } } });
  const allowed = rows.filter((row) => canSee(user, scope, row));
  if (!allowed.length) throw new HttpError(404, "No matching complaints");
  let count = 0;
  for (const row of allowed) {
    if (input.action === "assign") await updateComplaint(user, scope, row.id, { action: "assign", engineerId: input.engineerId });
    else if (input.action === "hold") await updateComplaint(user, scope, row.id, { action: "hold", holdReason: input.reason });
    else if (input.action === "cancel") await updateComplaint(user, scope, row.id, { action: "cancel", cancelReason: input.reason });
    else await updateComplaint(user, scope, row.id, { action: "priority", priority: input.priority });
    count++;
  }
  return { updated: count };
}

export async function importPreservedTicket(ticketNo: string) {
  const parsed = parseTicketNo(ticketNo);
  if (parsed) await rememberTicket(ticketNo);
}
