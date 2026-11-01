import { randomBytes, randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { COMPLAINT_SOURCES, COMPLAINT_STATUSES, COMPLAINT_TYPES, OPEN_WORK_STATUSES } from "@/lib/constants";
import { AppError } from "@/lib/errors";
import { canSeeComplaint } from "@/lib/permissions";
import { isMobile, normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { DEFAULT_SLA, isCloseBreach, isResponseBreach, slaDueDates } from "@/lib/sla";
import { ageRange, startOfDayIST, startOfMonthIST } from "@/lib/time";
import { formatTicket, nextTicketSeq } from "@/lib/ticket";
import { actionAllowedForStatus, assertTransition, assignmentStatus, resumeStatus } from "@/lib/workflow";
import type { CurrentUser } from "./current-user";
import { dispatchComplaintNotice } from "./notifications";
import { andWhere, complaintWhere } from "./scope";

const complaintListInclude = {
  customer: { select: { id: true, name: true, phone: true } },
  product: { select: { id: true, name: true, sku: true } },
  state: { select: { id: true, name: true } },
  district: { select: { id: true, name: true } },
  serviceCenter: { select: { id: true, name: true, engineerName: true } },
  assignedTo: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
} satisfies Prisma.ComplaintInclude;

export type ComplaintFilters = {
  q?: string;
  status?: string;
  type?: string;
  source?: string;
  stateId?: string;
  districtId?: string;
  technicianId?: string;
  productId?: string;
  brandId?: string;
  age?: string;
  sla?: string;
  open?: string;
  scheme?: string;
  from?: string;
  to?: string;
  since?: string;
  outcome?: string;
  page?: number;
  pageSize?: number;
};

function known(list: readonly { value: string }[], value: string, label: string) {
  if (!list.some((item) => item.value === value)) throw new AppError(`${label} is not valid.`);
}

export function filtersToWhere(filters: ComplaintFilters, now = new Date()): Prisma.ComplaintWhereInput {
  const parts: Prisma.ComplaintWhereInput[] = [];
  if (filters.q) parts.push({ searchText: { contains: filters.q.trim().toLowerCase() } });
  if (filters.open === "1" && !filters.status) parts.push({ status: { in: [...OPEN_WORK_STATUSES] } });
  if (filters.status) {
    const statuses = filters.status.split(",").map((status) => status.trim()).filter(Boolean);
    for (const status of statuses) known(COMPLAINT_STATUSES, status, "Status");
    parts.push(statuses.length === 1 ? { status: statuses[0] } : { status: { in: statuses } });
  }
  if (filters.type) {
    known(COMPLAINT_TYPES, filters.type, "Type");
    parts.push({ type: filters.type });
  }
  if (filters.source) parts.push({ source: filters.source });
  if (filters.stateId) parts.push({ stateId: filters.stateId });
  if (filters.districtId) parts.push({ districtId: filters.districtId });
  if (filters.technicianId) parts.push({ assignedToUserId: filters.technicianId });
  if (filters.productId) parts.push({ productId: filters.productId });
  if (filters.brandId) parts.push({ brandId: filters.brandId });
  if (filters.scheme) parts.push({ scheme: filters.scheme });
  if (filters.from || filters.to) {
    parts.push({
      createdAt: {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to.length <= 10 ? `${filters.to}T23:59:59` : filters.to) } : {}),
      },
    });
  }
  if (filters.since === "today" || filters.since === "month") {
    const boundary = filters.since === "today" ? startOfDayIST(now) : startOfMonthIST(now);
    if (filters.outcome === "closed") parts.push({ closedAt: { gte: boundary }, status: { in: ["CLOSED", "HAPPY_CALLING_DONE"] } });
    else if (filters.outcome === "happy") parts.push({ happyAt: { gte: boundary } });
    else if (filters.outcome === "cancelled") parts.push({ cancelledAt: { gte: boundary } });
    else parts.push({ createdAt: { gte: boundary } });
  }
  const range = filters.age ? ageRange(filters.age, now) : null;
  if (range) {
    parts.push({
      createdAt: range,
      ...(filters.status ? {} : { status: { in: [...OPEN_WORK_STATUSES] } }),
    });
  }
  if (filters.sla === "response" || filters.sla === "any") {
    const response: Prisma.ComplaintWhereInput = {
      status: { in: [...OPEN_WORK_STATUSES] },
      firstResponseAt: null,
      slaResponseDue: { lt: now },
    };
    const closing: Prisma.ComplaintWhereInput = {
      status: { in: [...OPEN_WORK_STATUSES] },
      slaCloseDue: { lt: now },
    };
    parts.push(filters.sla === "any" ? { OR: [response, closing] } : response);
  } else if (filters.sla === "close") {
    parts.push({ status: { in: [...OPEN_WORK_STATUSES] }, slaCloseDue: { lt: now } });
  }
  return andWhere(parts);
}

function searchText(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

export async function allocateTicket() {
  for (let attempt = 0; attempt < 3; attempt++) {
    const last = await prisma.complaint.aggregate({ _max: { ticketSeq: true } });
    const ticketSeq = nextTicketSeq(last._max.ticketSeq) + attempt;
    const existing = await prisma.complaint.findUnique({ where: { ticketSeq } });
    if (!existing) return { ticketSeq, ticketNumber: formatTicket(ticketSeq) };
  }
  throw new AppError("Could not allocate a ticket number. Try again.");
}

export async function suggestAssignee(pincode?: string | null, districtId?: string | null) {
  if (pincode) {
    const pin = await prisma.pincode.findUnique({ where: { code: pincode }, include: { serviceCenter: true } });
    if (pin?.serviceCenter?.active) {
      return { serviceCenter: pin.serviceCenter, reason: `Pincode ${pincode} is mapped to ${pin.serviceCenter.name}.` };
    }
  }
  if (districtId) {
    const preferred = await prisma.serviceCenter.findFirst({ where: { districtId, active: true, isDefault: true } });
    if (preferred) return { serviceCenter: preferred, reason: `${preferred.name} is the default centre for this district.` };
    const any = await prisma.serviceCenter.findFirst({ where: { districtId, active: true }, orderBy: { name: "asc" } });
    if (any) return { serviceCenter: any, reason: `${any.name} covers this district.` };
  }
  return { serviceCenter: null, reason: "No service centre covers this pincode or district yet." };
}

export type BookInput = {
  customerId?: string;
  customerName?: string;
  phone?: string;
  email?: string;
  address?: string;
  village?: string;
  stateId: string;
  districtId: string;
  areaId?: string;
  pincode?: string;
  serialNumber?: string;
  productId?: string;
  type: string;
  source: string;
  issueId?: string;
  description?: string;
  priority?: string;
  brandId?: string;
  scheme?: string;
  consumerNumber?: string;
  serviceCenterId?: string;
};

export async function bookComplaint(input: BookInput, user: CurrentUser) {
  if (!can(user.role, "book")) throw new AppError("You cannot book complaints.", 403);
  known(COMPLAINT_TYPES, input.type, "Complaint type");
  known(COMPLAINT_SOURCES, input.source, "Source");
  const district = await prisma.district.findUnique({ where: { id: input.districtId } });
  if (!district || district.stateId !== input.stateId) throw new AppError("Choose a district in the selected state.");
  if (input.areaId) {
    const area = await prisma.area.findUnique({ where: { id: input.areaId } });
    if (!area || area.districtId !== input.districtId) throw new AppError("Choose an area in the selected district.");
  }
  if (input.type === "SCHEME" && !input.scheme) throw new AppError("Choose MSEDCL or KUSUM for a scheme complaint.");
  if (input.scheme && !["MSEDCL", "KUSUM"].includes(input.scheme)) throw new AppError("Scheme must be MSEDCL or KUSUM.");

  const phone = normalizePhone(input.phone ?? "");
  let customer = input.customerId ? await prisma.customer.findUnique({ where: { id: input.customerId } }) : null;
  if (input.customerId && !customer) throw new AppError("Customer not found.", 404);
  if (!customer && phone) customer = await prisma.customer.findFirst({ where: { phone } });
  if (!customer) {
    if (!input.customerName?.trim()) throw new AppError("Customer name is required.");
    if (!isMobile(phone)) throw new AppError("Enter a 10-digit mobile number.");
    customer = await prisma.customer.create({
      data: {
        name: input.customerName.trim(),
        phone,
        email: input.email?.trim() || null,
        address: input.address?.trim() || null,
        village: input.village?.trim() || null,
        stateId: input.stateId,
        districtId: input.districtId,
        areaId: input.areaId || null,
        pincode: input.pincode || null,
        searchText: searchText([input.customerName, phone, input.village, input.address]),
      },
    });
  }

  const product = input.productId ? await prisma.product.findUnique({ where: { id: input.productId } }) : null;
  if (input.productId && !product) throw new AppError("Product not found.", 404);
  let brandId = input.brandId || product?.brandId || null;
  if (!brandId && user.brandIds.length === 1) brandId = user.brandIds[0];
  if (!canSeeComplaint(user, { stateId: input.stateId, districtId: input.districtId, brandId, assignedToUserId: user.id })) {
    throw new AppError("You cannot book a complaint outside your state, district or brand.", 403);
  }

  let assetId: string | null = null;
  const serial = input.serialNumber?.trim();
  if (serial) {
    const existingAsset = await prisma.installedAsset.findUnique({ where: { serialNumber: serial } });
    if (existingAsset) assetId = existingAsset.id;
    else {
      const created = await prisma.installedAsset.create({
        data: { serialNumber: serial, customerId: customer.id, productId: product?.id, installedOn: input.type === "INSTALLATION" ? null : new Date() },
      });
      assetId = created.id;
    }
  }

  const manual = input.serviceCenterId
    ? await prisma.serviceCenter.findUnique({ where: { id: input.serviceCenterId } })
    : null;
  if (input.serviceCenterId && !manual) throw new AppError("Service centre not found.", 404);
  const suggestion = manual
    ? { serviceCenter: manual, reason: "Chosen on the booking form." }
    : await suggestAssignee(input.pincode, input.districtId);
  const center = suggestion.serviceCenter;
  const now = new Date();
  const policy = await prisma.slaPolicy.findUnique({ where: { complaintType: input.type } });
  const hours = policy ?? { responseHours: DEFAULT_SLA[input.type]?.responseHours ?? 24, closeHours: DEFAULT_SLA[input.type]?.closeHours ?? 72 };
  const dues = slaDueDates(now, hours.responseHours, hours.closeHours);
  const ticket = await allocateTicket();
  const status = center ? "ASSIGNED" : "OPEN";

  const complaint = await prisma.complaint.create({
    data: {
      ...ticket,
      status,
      type: input.type,
      source: input.source,
      priority: input.priority || "NORMAL",
      customerId: customer.id,
      productId: product?.id,
      assetId,
      serialNumber: serial || null,
      brandId,
      issueId: input.issueId || null,
      description: input.description?.trim() || null,
      stateId: input.stateId,
      districtId: input.districtId,
      areaId: input.areaId || null,
      pincode: input.pincode || null,
      address: input.address?.trim() || customer.address,
      serviceCenterId: center?.id,
      assignedToUserId: center?.userId,
      assignedAt: center ? now : null,
      firstResponseAt: center ? now : null,
      scheme: input.scheme || null,
      consumerNumber: input.consumerNumber?.trim() || null,
      feedbackToken: randomBytes(16).toString("hex"),
      slaResponseDue: dues.slaResponseDue,
      slaCloseDue: dues.slaCloseDue,
      searchText: searchText([ticket.ticketNumber, customer.name, customer.phone, serial, product?.name, product?.sku, input.description]),
      createdById: user.id,
      events: {
        create: [
          { type: "BOOKED", message: `Complaint booked from ${input.source.toLowerCase().replaceAll("_", " ")}.`, userId: user.id },
          ...(center
            ? [{ type: "ASSIGNED", message: `Auto-assigned to ${center.name} (${center.engineerName}). ${suggestion.reason}`, userId: user.id }]
            : []),
        ],
      },
    },
  });

  await safeNotify("BOOKING", complaint.id);
  if (center) await safeNotify("ASSIGNMENT", complaint.id);
  return prisma.complaint.findUniqueOrThrow({ where: { id: complaint.id }, include: complaintListInclude });
}

async function safeNotify(event: string, complaintId: string) {
  try {
    await dispatchComplaintNotice(event, complaintId);
  } catch (error) {
    console.error(`Notification ${event} failed`, error);
  }
}

export async function listComplaints(user: CurrentUser, filters: ComplaintFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, filters.pageSize ?? 20);
  const where = andWhere([complaintWhere(user), filtersToWhere(filters)]);
  const [total, rows] = await Promise.all([
    prisma.complaint.count({ where }),
    prisma.complaint.findMany({
      where,
      include: complaintListInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { total, page, pageSize, rows };
}

export async function getComplaint(id: string, user: CurrentUser) {
  const complaint = await prisma.complaint.findUnique({
    where: { id },
    include: {
      customer: true,
      product: { include: { category: true, hpCapacity: true, pumpHead: true } },
      asset: true,
      brand: true,
      issue: true,
      state: true,
      district: true,
      area: true,
      serviceCenter: true,
      assignedTo: true,
      holdStatus: true,
      actualProblem: true,
      actualSolution: true,
      createdBy: { select: { id: true, name: true, role: true } },
      events: { include: { user: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "asc" } },
      attachments: { select: { id: true, fileName: true, mimeType: true, size: true, createdAt: true } },
      escalations: { include: { toUser: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!complaint || !canSeeComplaint(user, complaint)) return null;
  return complaint;
}

async function loadScoped(id: string, user: CurrentUser) {
  const complaint = await prisma.complaint.findUnique({ where: { id }, include: { serviceCenter: true, customer: true, product: true } });
  if (!complaint || !canSeeComplaint(user, complaint)) throw new AppError("Complaint not found.", 404);
  return complaint;
}

function touchBreaches<T extends { status: string; firstResponseAt: Date | null; slaResponseDue: Date | null; slaCloseDue: Date | null }>(complaint: T, now = new Date()) {
  return {
    responseBreached: isResponseBreach({ ...complaint, escalationLevel: 0 }, now),
    closeBreached: isCloseBreach({ ...complaint, escalationLevel: 0 }, now),
  };
}

export async function actOnComplaint(id: string, user: CurrentUser, body: Record<string, unknown>) {
  const action = String(body.type ?? "");
  const complaint = await loadScoped(id, user);
  const now = new Date();

  if (action === "note") {
    if (!can(user.role, "note")) throw new AppError("You cannot add notes.", 403);
    const message = String(body.message ?? "").trim();
    if (!message) throw new AppError("Write a note first.");
    await prisma.complaintEvent.create({ data: { complaintId: id, type: "NOTE", message, userId: user.id } });
    return { ok: true };
  }

  if (action === "visit") {
    if (!can(user.role, "visit") || !actionAllowedForStatus("visit", complaint.status)) throw new AppError("A visit cannot be logged on this complaint.", 403);
    const message = String(body.message ?? "").trim();
    if (!message) throw new AppError("Describe the visit.");
    await prisma.complaint.update({
      where: { id },
      data: { firstResponseAt: complaint.firstResponseAt ?? now, ...touchBreaches({ ...complaint, firstResponseAt: complaint.firstResponseAt ?? now }) },
    });
    await prisma.complaintEvent.create({ data: { complaintId: id, type: "VISIT", message, userId: user.id } });
    await safeNotify("VISIT", id);
    return { ok: true };
  }

  if (action === "assign") {
    if (!can(user.role, "assign") || !actionAllowedForStatus("assign", complaint.status)) throw new AppError("This complaint cannot be assigned.", 403);
    const center = await prisma.serviceCenter.findUnique({ where: { id: String(body.serviceCenterId ?? "") } });
    if (!center) throw new AppError("Choose a service centre.");
    const next = assignmentStatus(complaint.status, Boolean(complaint.assignedAt));
    assertTransition(complaint.status, next);
    await prisma.complaint.update({
      where: { id },
      data: {
        status: next,
        serviceCenterId: center.id,
        assignedToUserId: center.userId,
        assignedAt: now,
        firstResponseAt: complaint.firstResponseAt ?? now,
        holdStatusId: null,
        holdReason: null,
        heldAt: null,
        ...touchBreaches({ ...complaint, status: next, firstResponseAt: complaint.firstResponseAt ?? now }),
      },
    });
    await prisma.complaintEvent.create({
      data: {
        complaintId: id,
        type: next === "REASSIGNED" ? "REASSIGNED" : "ASSIGNED",
        message: `${next === "REASSIGNED" ? "Re-assigned" : "Assigned"} to ${center.name} (${center.engineerName}).`,
        userId: user.id,
      },
    });
    await safeNotify("ASSIGNMENT", id);
    return { ok: true };
  }

  if (action === "hold") {
    if (!can(user.role, "hold") || !actionAllowedForStatus("hold", complaint.status)) throw new AppError("This complaint cannot be put on hold.", 403);
    const hold = await prisma.holdStatus.findUnique({ where: { id: String(body.holdStatusId ?? "") } });
    const reason = String(body.reason ?? "").trim();
    if (!hold || !reason) throw new AppError("Choose a hold status and give a reason.");
    assertTransition(complaint.status, "PENDING");
    await prisma.complaint.update({
      where: { id },
      data: { status: "PENDING", holdStatusId: hold.id, holdReason: reason, heldAt: now },
    });
    await prisma.complaintEvent.create({ data: { complaintId: id, type: "HOLD", message: `On hold (${hold.name}): ${reason}`, userId: user.id } });
    return { ok: true };
  }

  if (action === "resume") {
    if (!can(user.role, "hold") || !actionAllowedForStatus("resume", complaint.status)) throw new AppError("This complaint is not on hold.", 403);
    const next = resumeStatus(Boolean(complaint.assignedToUserId || complaint.serviceCenterId));
    assertTransition(complaint.status, next);
    await prisma.complaint.update({
      where: { id },
      data: { status: next, holdStatusId: null, holdReason: null, heldAt: null },
    });
    await prisma.complaintEvent.create({ data: { complaintId: id, type: "RESUMED", message: "Hold cleared.", userId: user.id } });
    return { ok: true };
  }

  if (action === "close") {
    if (!can(user.role, "close") || !actionAllowedForStatus("close", complaint.status)) throw new AppError("This complaint cannot be closed.", 403);
    const problem = await prisma.actualProblem.findUnique({ where: { id: String(body.actualProblemId ?? "") } });
    const solution = await prisma.actualSolution.findUnique({ where: { id: String(body.actualSolutionId ?? "") } });
    if (!problem || !solution) throw new AppError("Choose the actual problem and the actual solution.");
    const notes = String(body.closeNotes ?? "").trim();
    const checklistIds = Array.isArray(body.checklistIds) ? body.checklistIds.map(String) : [];
    assertTransition(complaint.status, "CLOSED");
    await prisma.complaint.update({
      where: { id },
      data: {
        status: "CLOSED",
        actualProblemId: problem.id,
        actualSolutionId: solution.id,
        closeNotes: notes || null,
        closedAt: now,
        checklistJson: JSON.stringify(checklistIds),
        responseBreached: false,
        closeBreached: false,
      },
    });
    await prisma.complaintEvent.create({
      data: { complaintId: id, type: "CLOSED", message: `Closed. Problem: ${problem.name}. Solution: ${solution.name}.${notes ? ` ${notes}` : ""}`, userId: user.id },
    });
    // Phase 3: businessCentral.pushClosedComplaint(complaint.ticketNumber)
    await safeNotify("CLOSING", id);
    return { ok: true };
  }

  if (action === "happy") {
    if (!can(user.role, "happyCall") || !actionAllowedForStatus("happy", complaint.status)) throw new AppError("Happy calling is only available after the complaint is closed.", 403);
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new AppError("Choose a rating from 1 to 5.");
    const notes = String(body.notes ?? "").trim();
    assertTransition(complaint.status, "HAPPY_CALLING_DONE");
    await prisma.complaint.update({
      where: { id },
      data: { status: "HAPPY_CALLING_DONE", happyRating: rating, happyNotes: notes || null, happyAt: now },
    });
    await prisma.complaintEvent.create({ data: { complaintId: id, type: "HAPPY_CALL", message: `Happy calling recorded. Rating ${rating}/5.${notes ? ` ${notes}` : ""}`, userId: user.id } });
    return { ok: true };
  }

  if (action === "cancel") {
    if (!can(user.role, "cancel") || !actionAllowedForStatus("cancel", complaint.status)) throw new AppError("This complaint cannot be cancelled.", 403);
    const reason = String(body.reason ?? "").trim();
    if (!reason) throw new AppError("A cancellation reason is required.");
    assertTransition(complaint.status, "CANCELLED");
    await prisma.complaint.update({
      where: { id },
      data: { status: "CANCELLED", cancelReason: reason, cancelledAt: now, responseBreached: false, closeBreached: false },
    });
    await prisma.complaintEvent.create({ data: { complaintId: id, type: "CANCELLED", message: `Cancelled: ${reason}`, userId: user.id } });
    return { ok: true };
  }

  throw new AppError("Unknown action.");
}

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

export async function addAttachment(id: string, user: CurrentUser, file: { name: string; type: string; bytes: Buffer }) {
  if (!can(user.role, "attach")) throw new AppError("You cannot add attachments.", 403);
  await loadScoped(id, user);
  if (file.bytes.length > 5 * 1024 * 1024) throw new AppError("Attachments are limited to 5 MB.");
  if (file.type && !ALLOWED_MIME.has(file.type)) throw new AppError("Upload a photo, PDF, spreadsheet or text file.");
  const safeName = file.name.replace(/[^\w.\- ]+/g, "").slice(0, 120) || "file";
  await prisma.attachment.create({
    data: { complaintId: id, fileName: safeName, mimeType: file.type || "application/octet-stream", size: file.bytes.length, data: new Uint8Array(file.bytes), uploadedById: user.id },
  });
  await prisma.complaintEvent.create({ data: { complaintId: id, type: "ATTACHMENT", message: `Attached ${safeName}.`, userId: user.id } });
}

export async function lookupCustomers(query: { phone?: string; serial?: string }) {
  const serial = query.serial?.trim();
  if (serial) {
    const asset = await prisma.installedAsset.findUnique({
      where: { serialNumber: serial },
      include: { product: true, customer: { include: { state: true, district: true, area: true } } },
    });
    if (asset) return [{ customer: asset.customer, asset, product: asset.product }];
  }
  const phone = normalizePhone(query.phone ?? "");
  if (phone.length < 4) return [];
  const customers = await prisma.customer.findMany({
    where: { phone: { contains: phone } },
    include: { state: true, district: true, area: true, assets: { include: { product: true }, take: 3 } },
    take: 8,
  });
  return customers.map((customer) => ({ customer, asset: customer.assets[0] ?? null, product: customer.assets[0]?.product ?? null }));
}

export async function getFeedback(token: string) {
  const complaint = await prisma.complaint.findUnique({
    where: { feedbackToken: token },
    include: { customer: { select: { name: true } }, product: { select: { name: true } } },
  });
  if (!complaint) return null;
  return {
    ticketNumber: complaint.ticketNumber,
    customerName: complaint.customer.name,
    product: complaint.product?.name ?? null,
    status: complaint.status,
    rating: complaint.happyRating,
    closed: complaint.status === "CLOSED" || complaint.status === "HAPPY_CALLING_DONE",
  };
}

export async function submitFeedback(token: string, rating: number, notes: string) {
  const complaint = await prisma.complaint.findUnique({ where: { feedbackToken: token } });
  if (!complaint) throw new AppError("This feedback link is not valid.", 404);
  if (complaint.status === "HAPPY_CALLING_DONE") throw new AppError("Feedback is already recorded. Thank you.");
  if (complaint.status !== "CLOSED") throw new AppError("Feedback opens once the complaint is closed.");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new AppError("Choose a rating from 1 to 5.");
  const now = new Date();
  await prisma.complaint.update({
    where: { id: complaint.id },
    data: { status: "HAPPY_CALLING_DONE", happyRating: rating, happyNotes: notes.trim() || null, happyAt: now },
  });
  await prisma.complaintEvent.create({
    data: { complaintId: complaint.id, type: "FEEDBACK", message: `Customer feedback ${rating}/5.${notes.trim() ? ` ${notes.trim()}` : ""}` },
  });
}

export function newExternalToken() {
  return randomUUID();
}
