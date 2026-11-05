import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./db";
import { HttpError } from "./http";
import { normalizePhone } from "@/lib/mask";
import {
  assetKey,
  composeRepeatReason,
  coverStatus,
  isFirstTimeFix,
  personName,
  pickCustomer,
  placeKey,
  repeatWindowDays,
  type CustomerCandidate,
} from "@/lib/history";
import type { SessionUser } from "@/lib/types";

type Db = Prisma.TransactionClient | PrismaClient;

export type PartyInput = {
  companyId: string;
  name: string;
  phone: string;
  altPhone?: string | null;
  address?: string | null;
  stateId?: string | null;
  districtId?: string | null;
  areaId?: string | null;
  pincode?: string | null;
  village?: string | null;
  isTest?: boolean;
  productId?: string | null;
  productName?: string | null;
  modelName?: string | null;
  serialNorm?: string | null;
  capacityLabel?: string | null;
};

function candidate(row: {
  id: string;
  name: string;
  phone: string;
  altPhone: string | null;
  pincode: string | null;
  village: string | null;
  mergedIntoId: string | null;
  phones: { phoneNorm: string }[];
}): CustomerCandidate {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    altPhone: row.altPhone,
    extraPhones: row.phones.map((item) => item.phoneNorm),
    pincode: row.pincode,
    village: row.village,
    mergedIntoId: row.mergedIntoId,
  };
}

export async function findCustomer(db: Db, input: { phone: string; name: string; pincode?: string | null; village?: string | null }) {
  const phone = normalizePhone(input.phone);
  const name = personName(input.name);
  const pin = placeKey(input.pincode);
  const village = placeKey(input.village);
  const or: Prisma.CustomerWhereInput[] = [];
  if (phone.length >= 8) {
    or.push({ phone }, { phoneNorm: phone }, { altPhone: phone }, { phones: { some: { phoneNorm: phone } } });
  }
  if (name && pin) or.push({ nameNorm: name, pincode: pin });
  if (name && village) or.push({ nameNorm: name, village });
  if (!or.length) return null;
  const rows = await db.customer.findMany({ where: { OR: or }, include: { phones: true }, take: 25 });
  const match = pickCustomer(rows.map(candidate), { phone, name: input.name, pincode: pin, village });
  if (!match) return null;
  const row = rows.find((item) => item.id === match.id) ?? null;
  return row ? { customer: row, basis: match.basis } : null;
}

async function rememberPhone(db: Db, customerId: string, phone: string, primary: string) {
  const norm = normalizePhone(phone);
  if (norm.length < 8 || norm === primary) return;
  const owned = await db.customerPhone.findUnique({ where: { phoneNorm: norm } });
  if (owned) return;
  const primaryOwner = await db.customer.findFirst({ where: { phoneNorm: norm } });
  if (primaryOwner && primaryOwner.id !== customerId) return;
  await db.customerPhone.create({ data: { customerId, phoneNorm: norm } });
}

export async function ensureCustomer(db: Db, input: PartyInput) {
  const phone = normalizePhone(input.phone);
  const village = placeKey(input.village);
  const found = await findCustomer(db, { phone, name: input.name, pincode: input.pincode, village });
  if (found) {
    const customer = await db.customer.update({
      where: { id: found.customer.id },
      data: {
        name: input.name,
        nameNorm: personName(input.name),
        address: input.address ?? found.customer.address,
        stateId: input.stateId ?? found.customer.stateId,
        districtId: input.districtId ?? found.customer.districtId,
        areaId: input.areaId ?? found.customer.areaId,
        pincode: input.pincode ?? found.customer.pincode,
        village: village ?? found.customer.village,
        isTest: Boolean(input.isTest || found.customer.isTest),
        altPhone: found.customer.altPhone ?? (found.basis === "name-place" ? phone : input.altPhone ?? null),
      },
      include: { phones: true },
    });
    if (found.basis === "name-place") await rememberPhone(db, customer.id, phone, customer.phoneNorm ?? customer.phone);
    if (input.altPhone) await rememberPhone(db, customer.id, input.altPhone, customer.phoneNorm ?? customer.phone);
    return { customer, basis: found.basis as "phone" | "alternate" | "name-place" };
  }
  const customer = await db.customer.create({
    data: {
      companyId: input.companyId,
      name: input.name,
      phone,
      phoneNorm: phone,
      nameNorm: personName(input.name),
      altPhone: input.altPhone ? normalizePhone(input.altPhone) : null,
      address: input.address,
      stateId: input.stateId,
      districtId: input.districtId,
      areaId: input.areaId,
      pincode: input.pincode,
      village,
      isTest: Boolean(input.isTest),
    },
    include: { phones: true },
  });
  if (input.altPhone) await rememberPhone(db, customer.id, input.altPhone, phone);
  return { customer, basis: "created" as const };
}

export async function ensureAsset(db: Db, input: PartyInput & { customerId: string }) {
  const key = assetKey({
    serialNorm: input.serialNorm,
    customerId: input.customerId,
    productId: input.productId,
    productName: input.productName,
    capacityLabel: input.capacityLabel,
  });
  const existing = await db.asset.findUnique({ where: { identityKey: key } });
  if (existing) {
    return db.asset.update({
      where: { id: existing.id },
      data: {
        productId: input.productId ?? existing.productId,
        productName: input.productName ?? existing.productName,
        modelName: input.modelName ?? existing.modelName,
        capacityLabel: input.capacityLabel ?? existing.capacityLabel,
        serialNorm: input.serialNorm ?? existing.serialNorm,
        customerId: input.serialNorm ? existing.customerId : input.customerId,
      },
    });
  }
  return db.asset.create({
    data: {
      companyId: input.companyId,
      customerId: input.customerId,
      productId: input.productId,
      productName: input.productName,
      modelName: input.modelName ?? input.productName,
      serialNorm: input.serialNorm,
      capacityLabel: input.capacityLabel,
      identityKey: key,
    },
  });
}

export async function relinkAsset(db: Db, assetId: string) {
  const rows = await db.complaint.findMany({
    where: { assetId },
    orderBy: [{ bookDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      ticketNo: true,
      bookDate: true,
      closedAt: true,
      status: true,
      duplicateOfTicket: true,
    },
  });
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const prior = index > 0 ? rows[index - 1] : null;
    const earlier = Boolean(prior && (prior.bookDate < row.bookDate || (prior.bookDate.getTime() === row.bookDate.getTime() && prior.ticketNo < row.ticketNo)));
    const link = earlier && prior && ["CLOSED", "HAPPY_CALLING"].includes(prior.status) ? prior : null;
    const window = link ? repeatWindowDays(link.bookDate, row.bookDate) : null;
    const later = rows.slice(index + 1).map((item) => item.bookDate);
    const closed = row.closedAt && (row.status === "CLOSED" || row.status === "HAPPY_CALLING" || row.status === "CLOSED_UNVERIFIED");
    await db.complaint.update({
      where: { id: row.id },
      data: {
        repeatOfTicket: link?.ticketNo ?? null,
        repeatWindow: window,
        repeatFlag: window != null || Boolean(row.duplicateOfTicket),
        repeatReason: composeRepeatReason(row.duplicateOfTicket, link?.ticketNo, window),
        firstTimeFix: closed ? isFirstTimeFix({ repeatWindow: window, closedAt: row.closedAt, laterBookDates: later }) : null,
      },
    });
  }
}

export async function loadCustomerHistory(phone: string) {
  const found = await findCustomer(prisma, { phone, name: "" });
  if (!found) return null;
  const [complaints, assets] = await Promise.all([
    prisma.complaint.findMany({
      where: { customerId: found.customer.id },
      orderBy: { bookDate: "desc" },
      take: 20,
      include: { spares: true, asset: true },
    }),
    prisma.asset.findMany({ where: { customerId: found.customer.id }, orderBy: { productName: "asc" } }),
  ]);
  return {
    customerId: found.customer.id,
    name: found.customer.name,
    phone: found.customer.phone,
    basis: found.basis,
    assets: assets.map((asset) => ({
      id: asset.id,
      label: [asset.modelName || asset.productName || "Installed product", asset.capacityLabel, asset.serialNorm].filter(Boolean).join(" · "),
      ...coverStatus(asset),
    })),
    complaints: complaints.map((row) => ({
      id: row.id,
      ticketNo: row.ticketNo,
      status: row.status,
      bookDate: row.bookDate,
      closedAt: row.closedAt,
      technician: row.assignedName,
      problem: row.actualProblem || row.natureText,
      resolution: row.actualSolution,
      spares: row.spares.map((spare) => `${spare.partName} × ${spare.qty}`),
      repeatOfTicket: row.repeatOfTicket,
      repeatWindow: row.repeatWindow,
      assetId: row.assetId,
    })),
  };
}

export async function mergeCustomers(user: SessionUser, keepId: string, dropId: string) {
  if (user.role !== "ADMIN") throw new HttpError(403, "Only an admin can merge customers");
  if (!keepId || !dropId || keepId === dropId) throw new HttpError(400, "Choose two different customers");
  return prisma.$transaction(async (tx) => {
    const keep = await tx.customer.findUnique({ where: { id: keepId }, include: { phones: true, assets: true } });
    const drop = await tx.customer.findUnique({ where: { id: dropId }, include: { phones: true, assets: true } });
    if (!keep || !drop) throw new HttpError(404, "Customer was not found");
    if (keep.mergedIntoId || drop.mergedIntoId) throw new HttpError(400, "That customer was already merged");
    const numbers = [drop.phone, drop.altPhone, ...drop.phones.map((item) => item.phoneNorm)];
    for (const number of numbers) {
      if (number) await rememberPhone(tx, keep.id, number, keep.phoneNorm ?? keep.phone);
    }
    await tx.customerPhone.deleteMany({ where: { customerId: drop.id } });
    const { retargetAssets } = await import("@/lib/history");
    const plan = retargetAssets(keep.id, drop.assets, keep.assets.map((item) => item.identityKey));
    for (const step of plan) {
      if (step.foldIntoKey) {
        const target = await tx.asset.findUnique({ where: { identityKey: step.foldIntoKey } });
        if (target) {
          await tx.complaint.updateMany({ where: { assetId: step.id }, data: { assetId: target.id } });
          await tx.asset.delete({ where: { id: step.id } });
          await relinkAsset(tx, target.id);
          continue;
        }
      }
      await tx.asset.update({ where: { id: step.id }, data: { customerId: keep.id, identityKey: step.identityKey } });
      await relinkAsset(tx, step.id);
    }
    const moved = await tx.complaint.updateMany({ where: { customerId: drop.id }, data: { customerId: keep.id } });
    await tx.customer.update({
      where: { id: drop.id },
      data: { mergedIntoId: keep.id, phoneNorm: null },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        companyId: keep.companyId,
        entity: "Customer",
        entityId: keep.id,
        action: "MERGE",
        summary: `Merged ${drop.name} (${drop.phone}) into ${keep.name} (${keep.phone})`,
        before: { dropId: drop.id, dropName: drop.name, dropPhone: drop.phone },
        after: { keepId: keep.id, complaintsMoved: moved.count },
      },
    });
    return { keepId: keep.id, dropId: drop.id, complaintsMoved: moved.count };
  });
}
