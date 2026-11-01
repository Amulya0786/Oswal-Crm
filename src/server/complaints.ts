import { z } from "zod";
import { prisma, bumpVersion } from "./db";
import { HttpError } from "./http";
import { nextTicketNo, rememberTicket } from "./ticket-seq";
import { canSee } from "./scope";
import { suggestTechnicians } from "./assignment";
import { notifyComplaint, queueWebhook } from "./notify";
import { bookingConflicts, type BookingRow } from "@/lib/duplicates";
import { resolveSerial, validateSerial, channelFor } from "@/lib/quality";
import { normalizePhone } from "@/lib/mask";
import { labelOf, STATUSES, DEFAULT_SLA_HOURS, ACTIVE_STATUSES } from "@/lib/labels";
import { assessSla } from "@/lib/sla";
import { loadRiskContext } from "./query";
import { displayPhone } from "@/lib/mask";
import { formatDay } from "@/lib/time";
import type { SessionUser } from "@/lib/types";
import { parseTicketNo } from "@/lib/ticket";

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
});

export type BookInput = z.infer<typeof bookSchema>;

function clean(value?: string | null) {
  const text = value?.trim();
  return text ? text : null;
}

async function slaHours(companyId: string, callType: string) {
  const policy = await prisma.slaPolicy.findUnique({ where: { companyId_callType: { companyId, callType } } });
  return policy?.active === false ? DEFAULT_SLA_HOURS[callType] ?? 72 : policy?.hours ?? DEFAULT_SLA_HOURS[callType] ?? 72;
}

export async function createComplaint(user: SessionUser | null, inputRaw: unknown, opts?: { publicForm?: boolean }) {
  const input = bookSchema.parse(inputRaw);
  if (user && !user.caps.book && !opts?.publicForm) throw new HttpError(403, "You cannot book complaints");
  if (user && user.role !== "ADMIN" && !user.companyIds.includes(input.companyId)) throw new HttpError(403, "You cannot book for that company");
  const phone = normalizePhone(input.phone);
  if (phone.length !== 10) throw new HttpError(400, "Enter a 10-digit mobile number");
  if (!input.natureId && !clean(input.natureText)) throw new HttpError(400, "Choose the nature of the complaint");

  const company = await prisma.company.findUnique({ where: { id: input.companyId } });
  if (!company) throw new HttpError(400, "Choose a company");

  let districtId = clean(input.districtId);
  let stateId = clean(input.stateId);
  let areaId = clean(input.areaId);
  const pincode = clean(input.pincode);
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
    input.brandId ? prisma.brand.findUnique({ where: { id: input.brandId } }) : prisma.brand.findFirst({ where: { companyId: company.id, name: "OSWAL" } }),
    input.natureId ? prisma.complaintIssue.findUnique({ where: { id: input.natureId } }) : null,
    input.categoryId ? prisma.category.findUnique({ where: { id: input.categoryId } }) : null,
  ]);
  if (!state || !district) throw new HttpError(400, "State or district was not found");

  const serial = resolveSerial({ serial: input.serialNo, unavailable: input.serialUnavailable, reason: input.serialUnavailableReason });
  if (!serial.ok) throw new HttpError(400, serial.reason);
  const capacityLabel = product?.hpId ? (await prisma.hpCapacity.findUnique({ where: { id: product.hpId } }))?.label ?? null : null;
  const existingCustomer = await prisma.customer.findUnique({ where: { companyId_phone: { companyId: company.id, phone } } });
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
  const override = clean(input.duplicateOverrideReason);
  if ((conflicts.blocking.length || conflicts.sameDay.length || otherOwner) && (!input.acknowledgeDuplicate || !override || override.length < 8)) {
    const reason = otherOwner && !conflicts.reason
      ? `Serial ${serial.serial} is already linked to ${otherOwner.customerName} on ${otherOwner.ticketNo}.`
      : conflicts.reason ?? "A similar complaint already exists";
    throw new HttpError(409, reason, {
      duplicates: [...conflicts.blocking, ...conflicts.sameDay].map((row) => ({ ticketNo: row.ticketNo, status: row.status, basis: row.basis })),
      otherOwner,
      reason,
    });
  }

  const assignMode = input.assignMode ?? "suggest";
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

  const hours = await slaHours(company.id, input.callType);
  const bookDate = new Date();
  const scheduleDate = clean(input.scheduleDate) ? new Date(input.scheduleDate!) : null;
  const source = opts?.publicForm ? (input.source === "QR" ? "QR" : "WEB") : user?.role === "DEALER" ? "DEALER" : input.source || "CALL";
  const status = engineer ? "ASSIGNED" : "OPEN";
  const actorName = user?.name ?? (source === "QR" ? "QR link" : "Web form");

  const created = await prisma.$transaction(async (tx) => {
    const ticketNo = await nextTicketNo(bookDate);
    const customer = existingCustomer
      ? await tx.customer.update({
          where: { id: existingCustomer.id },
          data: {
            name: input.customerName,
            address: clean(input.address) ?? existingCustomer.address,
            stateId,
            districtId,
            areaId,
            pincode,
            isTest: Boolean(user?.isTest || existingCustomer.isTest),
          },
        })
      : await tx.customer.create({
          data: {
            companyId: company.id,
            name: input.customerName,
            phone,
            isTest: Boolean(user?.isTest),
            altPhone: clean(input.altPhone),
            address: clean(input.address),
            stateId,
            districtId,
            areaId,
            pincode,
          },
        });
    const complaint = await tx.complaint.create({
      data: {
        ticketNo,
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
        excludeFromMis: Boolean(user?.isTest || existingCustomer?.isTest),
        serialCustomerMismatch: Boolean(otherOwner),
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
        slaDueAt: new Date(bookDate.getTime() + hours * 3600 * 1000),
        slaHours: hours,
        repeatFlag: conflicts.blocking.length > 0 || Boolean(otherOwner),
        repeatReason: conflicts.reason,
        assignReason,
        createdById: user?.id,
      },
    });
    await tx.complaintEvent.create({
      data: {
        complaintId: complaint.id,
        actorId: user?.id,
        actorName,
        type: "CREATED",
        message: `Booked ${ticketNo}${serial.pending ? " · serial pending" : ""}${engineer ? ` and assigned to ${engineer.name}` : ""}${override ? ` · duplicate override: ${override}` : ""}`,
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
  });

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
  return created;
}

const actionSchema = z.object({
  action: z.enum(["assign", "hold", "close", "happy", "cancel", "reopen", "schedule", "priority", "note"]),
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
  return {
    ...row,
    phone: displayPhone(row.phone, mask),
    altPhone: mask ? null : row.altPhone,
    slaBreached: signal.breached,
    slaRisk: signal.risk,
    slaRiskReason: signal.reason,
    timeline: buildTimeline(row),
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
    message = `Happy calling done, ${input.rating}/5`;
    notifyEvent = "FEEDBACK";
  } else if (input.action === "cancel") {
    if (!user.caps.cancel) throw new HttpError(403, "You cannot cancel this complaint");
    if (current.status === "HAPPY_CALLING" || current.status === "CANCELLED") throw new HttpError(400, "This complaint cannot be cancelled");
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
  } else if (input.action === "priority") {
    if (!user.caps.assign && user.role !== "ADMIN") throw new HttpError(403, "You cannot change priority");
    if (!input.priority) throw new HttpError(400, "Choose a priority");
    data.priority = input.priority;
    message = `Priority set to ${input.priority}`;
    type = "PRIORITY";
  }

  const updated = await prisma.$transaction(async (tx) => {
    const complaint = await tx.complaint.update({ where: { id: current.id }, data });
    await tx.complaintEvent.create({
      data: { complaintId: current.id, actorId: user.id, actorName: user.name, type, message },
    });
    if (input.action === "close" && input.checklist?.length) {
      await tx.complaintCheck.deleteMany({ where: { complaintId: current.id } });
      await tx.complaintCheck.createMany({
        data: input.checklist.filter((item) => item.checked).map((item) => ({ complaintId: current.id, itemId: item.itemId, checked: true })),
      });
    }
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
