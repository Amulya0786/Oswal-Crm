import { randomBytes } from "crypto";
import * as xlsx from "xlsx";
import { AppError } from "@/lib/errors";
import { IMPORT_TARGETS, applyMapping, cellString, excelDate, suggestMapping, type ImportEntity, type ImportField } from "@/lib/import/targets";
import { mapRole, mapSource, mapStatus, mapType } from "@/lib/import/values";
import { isMobile, normalizePhone } from "@/lib/phone";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SLA, slaDueDates } from "@/lib/sla";
import { formatTicket, nextTicketSeq } from "@/lib/ticket";
import { suggestAssignee } from "./complaints";
import type { CurrentUser } from "./current-user";
import { audit } from "./audit";

export function readSheet(buffer: Buffer, entity: ImportEntity, sheetName?: string) {
  const workbook = xlsx.read(buffer, { type: "buffer", cellDates: true });
  const preferred = IMPORT_TARGETS[entity].label;
  const sheet = sheetName && workbook.SheetNames.includes(sheetName) ? sheetName : workbook.SheetNames.includes(preferred) ? preferred : workbook.SheetNames[0];
  if (!sheet || !workbook.Sheets[sheet]) throw new AppError("The workbook has no readable sheet.");
  const matrix = xlsx.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheet], { header: 1, defval: "" });
  const headers = (matrix[0] ?? []).map((cell) => String(cell ?? "").trim()).filter(Boolean);
  const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheet], { defval: "", raw: true });
  return { sheets: workbook.SheetNames, sheet, headers, rows };
}

function phoneOf(value: unknown) {
  if (typeof value === "number") return normalizePhone(String(Math.round(value)));
  return normalizePhone(cellString(value));
}

function findNamed<T extends { name: string }>(rows: T[], name: string) {
  const needle = name.trim().toLowerCase();
  return rows.find((row) => row.name.toLowerCase() === needle);
}

export async function runImport(input: {
  entity: ImportEntity;
  rows: Record<string, unknown>[];
  mapping: Record<string, string>;
  user: CurrentUser;
  write: boolean;
}) {
  if (input.rows.length > 5000) throw new AppError("Import a maximum of 5000 rows at a time.");
  const fields = IMPORT_TARGETS[input.entity].fields;
  const mapped = input.rows.map((row) => applyMapping(row, input.mapping));
  const preview = mapped.slice(0, 12).map((row) => Object.fromEntries(fields.map((field) => [field.key, cellString(row[field.key])])));
  const missing = fields.filter((field) => field.required && !input.mapping[field.key]).map((field) => field.label);

  const states = await prisma.state.findMany({ include: { districts: true } });
  const products = await prisma.product.findMany({ include: { brand: true } });
  const brands = await prisma.brand.findMany();
  const categories = await prisma.category.findMany();
  const issues = await prisma.complaintIssue.findMany();
  const hp = await prisma.hpCapacity.findMany();
  const heads = await prisma.pumpHead.findMany();
  const hsn = await prisma.hsnCode.findMany();
  const policies = await prisma.slaPolicy.findMany();
  const hold = await prisma.holdStatus.findFirst({ orderBy: { name: "asc" } });

  let created = 0;
  let updated = 0;
  const failed: { row: number; error: string }[] = [];

  for (let index = 0; index < mapped.length; index++) {
    try {
      const outcome = await importRow(input.entity, mapped[index], fields, input.write, {
        states,
        products,
        brands,
        categories,
        issues,
        hp,
        heads,
        hsn,
        policies,
        holdId: hold?.id ?? null,
        userId: input.user.id,
      });
      if (input.write) {
        if (outcome === "updated") updated++;
        else created++;
      }
    } catch (error) {
      failed.push({ row: index + 2, error: error instanceof Error ? error.message : "Could not import this row." });
    }
  }

  if (input.write) {
    await audit({ entity: "import", action: input.entity, userId: input.user.id, changes: { created, updated, failed: failed.length } });
  }
  return { created, updated, failed: failed.slice(0, 40), failedCount: failed.length, preview, missing, rowCount: mapped.length };
}

type Refs = {
  states: { id: string; name: string; districts: { id: string; name: string }[] }[];
  products: { id: string; name: string; sku: string; brandId: string | null }[];
  brands: { id: string; name: string; code: string }[];
  categories: { id: string; name: string }[];
  issues: { id: string; name: string }[];
  hp: { id: string; name: string; hp: number }[];
  heads: { id: string; name: string }[];
  hsn: { id: string; code: string }[];
  policies: { complaintType: string; responseHours: number; closeHours: number }[];
  holdId: string | null;
  userId: string;
};

async function importRow(entity: ImportEntity, row: Record<string, unknown>, fields: ImportField[], write: boolean, refs: Refs): Promise<"created" | "updated"> {
  for (const field of fields) {
    if (field.required && !cellString(row[field.key])) throw new AppError(`${field.label} is required.`);
  }
  if (entity === "customers") return importCustomer(row, write, refs);
  if (entity === "products") return importProduct(row, write, refs);
  if (entity === "users") return importUser(row, write, refs);
  return importComplaint(row, write, refs);
}

async function importCustomer(row: Record<string, unknown>, write: boolean, refs: Refs): Promise<"created" | "updated"> {
  const phone = phoneOf(row.phone);
  if (!isMobile(phone)) throw new AppError("Mobile must be a 10-digit Indian number.");
  const state = cellString(row.state) ? findNamed(refs.states, cellString(row.state)) : undefined;
  if (cellString(row.state) && !state) throw new AppError(`State "${cellString(row.state)}" was not found.`);
  const district = state && cellString(row.district) ? findNamed(state.districts, cellString(row.district)) : undefined;
  if (cellString(row.district) && !district) throw new AppError(`District "${cellString(row.district)}" was not found in ${state?.name ?? "the state"}.`);
  const existing = await prisma.customer.findFirst({ where: { phone } });
  if (!write) return existing ? "updated" : "created";
  const data = {
    name: cellString(row.customerName),
    phone,
    email: cellString(row.email) || null,
    address: cellString(row.address) || null,
    village: cellString(row.village) || null,
    stateId: state?.id,
    districtId: district?.id,
    pincode: cellString(row.pincode) || null,
    searchText: [cellString(row.customerName), phone, cellString(row.village)].join(" ").toLowerCase(),
  };
  const customer = existing ? await prisma.customer.update({ where: { id: existing.id }, data }) : await prisma.customer.create({ data });
  const serial = cellString(row.serialNumber);
  if (serial) {
    await prisma.installedAsset.upsert({
      where: { serialNumber: serial },
      update: { customerId: customer.id },
      create: { serialNumber: serial, customerId: customer.id },
    });
  }
  return existing ? "updated" : "created";
}

async function importProduct(row: Record<string, unknown>, write: boolean, refs: Refs): Promise<"created" | "updated"> {
  const sku = cellString(row.sku).toUpperCase();
  const name = cellString(row.name);
  const brand = cellString(row.brand) ? refs.brands.find((item) => item.name.toLowerCase() === cellString(row.brand).toLowerCase() || item.code.toLowerCase() === cellString(row.brand).toLowerCase()) : undefined;
  if (cellString(row.brand) && !brand) throw new AppError(`Brand "${cellString(row.brand)}" was not found.`);
  const category = cellString(row.category) ? findNamed(refs.categories, cellString(row.category)) : undefined;
  const hsn = cellString(row.hsn) ? refs.hsn.find((item) => item.code === cellString(row.hsn)) : undefined;
  const hp = cellString(row.hp) ? refs.hp.find((item) => item.name.toLowerCase() === cellString(row.hp).toLowerCase() || String(item.hp) === cellString(row.hp)) : undefined;
  const head = cellString(row.head) ? findNamed(refs.heads, cellString(row.head)) : undefined;
  const existing = await prisma.product.findUnique({ where: { sku } });
  if (!write) return existing ? "updated" : "created";
  const data = {
    sku,
    name,
    family: cellString(row.family) || existing?.family || "Submersible",
    brandId: brand?.id,
    categoryId: category?.id,
    hsnId: hsn?.id,
    hpCapacityId: hp?.id,
    pumpHeadId: head?.id,
    warrantyMonths: cellString(row.warrantyMonths) ? Number(row.warrantyMonths) : existing?.warrantyMonths ?? 12,
  };
  if (existing) await prisma.product.update({ where: { id: existing.id }, data });
  else await prisma.product.create({ data });
  return existing ? "updated" : "created";
}

async function importUser(row: Record<string, unknown>, write: boolean, refs: Refs): Promise<"created" | "updated"> {
  const email = cellString(row.email).toLowerCase();
  if (!email.includes("@")) throw new AppError("Email is not valid.");
  const role = mapRole(cellString(row.role));
  if (!role) throw new AppError(`Role "${cellString(row.role)}" is not recognised.`);
  const stateNames = cellString(row.state).split(/[;,]/).map((part) => part.trim()).filter(Boolean);
  const districtNames = cellString(row.district).split(/[;,]/).map((part) => part.trim()).filter(Boolean);
  const brandNames = cellString(row.brand).split(/[;,]/).map((part) => part.trim()).filter(Boolean);
  const stateIds = stateNames.map((name) => {
    const state = findNamed(refs.states, name);
    if (!state) throw new AppError(`State "${name}" was not found.`);
    return state.id;
  });
  const districtIds = districtNames.map((name) => {
    const district = refs.states.flatMap((state) => state.districts).find((item) => item.name.toLowerCase() === name.toLowerCase());
    if (!district) throw new AppError(`District "${name}" was not found.`);
    return district.id;
  });
  const brandIds = brandNames.map((name) => {
    const brand = refs.brands.find((item) => item.name.toLowerCase() === name.toLowerCase() || item.code.toLowerCase() === name.toLowerCase());
    if (!brand) throw new AppError(`Brand "${name}" was not found.`);
    return brand.id;
  });
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!write) return existing ? "updated" : "created";
  const password = cellString(row.password);
  const data = {
    name: cellString(row.name),
    email,
    role,
    phone: phoneOf(row.phone) || null,
    employeeCode: cellString(row.employeeCode) || existing?.employeeCode || `IMP-${Date.now().toString().slice(-6)}`,
  };
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { ...data, ...(password ? { passwordHash: hashPassword(password) } : {}) } })
    : await prisma.user.create({ data: { ...data, passwordHash: hashPassword(password || "Welcome@123") } });
  await prisma.userStateAccess.deleteMany({ where: { userId: user.id } });
  await prisma.userDistrictAccess.deleteMany({ where: { userId: user.id } });
  await prisma.userBrandAccess.deleteMany({ where: { userId: user.id } });
  if (stateIds.length) await prisma.userStateAccess.createMany({ data: stateIds.map((stateId) => ({ userId: user.id, stateId })) });
  if (districtIds.length) await prisma.userDistrictAccess.createMany({ data: districtIds.map((districtId) => ({ userId: user.id, districtId })) });
  if (brandIds.length) await prisma.userBrandAccess.createMany({ data: brandIds.map((brandId) => ({ userId: user.id, brandId })) });
  return existing ? "updated" : "created";
}

async function importComplaint(row: Record<string, unknown>, write: boolean, refs: Refs): Promise<"created" | "updated"> {
  const phone = phoneOf(row.phone);
  if (!isMobile(phone)) throw new AppError("Mobile must be a 10-digit Indian number.");
  const mappedType = mapType(cellString(row.type));
  if (!mappedType) throw new AppError(`Complaint type "${cellString(row.type)}" is not recognised.`);
  const status = cellString(row.status) ? mapStatus(cellString(row.status)) : "OPEN";
  if (!status) throw new AppError(`Status "${cellString(row.status)}" is not recognised.`);
  const state = findNamed(refs.states, cellString(row.state));
  if (!state) throw new AppError(`State "${cellString(row.state)}" was not found.`);
  const district = findNamed(state.districts, cellString(row.district));
  if (!district) throw new AppError(`District "${cellString(row.district)}" was not found in ${state.name}.`);
  const sourceText = cellString(row.source);
  const source = sourceText ? mapSource(sourceText) ?? "CALL" : "CALL";
  const scheme = (cellString(row.scheme) || mappedType.scheme || "").toUpperCase() || null;
  if (mappedType.type === "SCHEME" && scheme && !["MSEDCL", "KUSUM"].includes(scheme)) throw new AppError("Scheme must be MSEDCL or KUSUM.");
  const externalRef = cellString(row.externalRef) || null;
  const existing = externalRef ? await prisma.complaint.findUnique({ where: { externalRef } }) : null;
  if (!write) return existing ? "updated" : "created";

  let customer = await prisma.customer.findFirst({ where: { phone } });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        name: cellString(row.customerName),
        phone,
        stateId: state.id,
        districtId: district.id,
        pincode: cellString(row.pincode) || null,
        searchText: [cellString(row.customerName), phone].join(" ").toLowerCase(),
      },
    });
  }
  const productText = cellString(row.product);
  const product = productText
    ? refs.products.find((item) => item.sku.toLowerCase() === productText.toLowerCase() || item.name.toLowerCase() === productText.toLowerCase())
    : undefined;
  const issueText = cellString(row.issue);
  const issue = issueText ? refs.issues.find((item) => item.name.toLowerCase() === issueText.toLowerCase()) : undefined;
  const serial = cellString(row.serialNumber) || null;
  let assetId: string | null = null;
  if (serial) {
    const asset = await prisma.installedAsset.upsert({
      where: { serialNumber: serial },
      update: { customerId: customer.id, productId: product?.id },
      create: { serialNumber: serial, customerId: customer.id, productId: product?.id },
    });
    assetId = asset.id;
  }
  const loggedOn = excelDate(row.loggedOn) ?? new Date();
  const policy = refs.policies.find((item) => item.complaintType === mappedType.type);
  const hours = policy ?? DEFAULT_SLA[mappedType.type] ?? { responseHours: 24, closeHours: 72 };
  const dues = slaDueDates(loggedOn, hours.responseHours, hours.closeHours);
  const description = [cellString(row.description), issueText && !issue ? `Issue: ${issueText}` : ""].filter(Boolean).join("\n");
  const suggestion = status === "OPEN" ? null : (await suggestAssignee(cellString(row.pincode), district.id)).serviceCenter;
  const data = {
    status,
    type: mappedType.type,
    source,
    customerId: customer.id,
    productId: product?.id,
    assetId,
    serialNumber: serial,
    brandId: product?.brandId ?? refs.brands.find((item) => item.code === "OSW")?.id ?? null,
    issueId: issue?.id,
    description: description || null,
    stateId: state.id,
    districtId: district.id,
    pincode: cellString(row.pincode) || null,
    scheme: scheme || (mappedType.type === "SCHEME" ? "MSEDCL" : null),
    consumerNumber: cellString(row.consumerNumber) || null,
    serviceCenterId: suggestion?.id,
    assignedToUserId: suggestion?.userId,
    assignedAt: suggestion ? loggedOn : null,
    firstResponseAt: status === "OPEN" ? null : loggedOn,
    closedAt: status === "CLOSED" || status === "HAPPY_CALLING_DONE" ? loggedOn : null,
    happyAt: status === "HAPPY_CALLING_DONE" ? loggedOn : null,
    cancelledAt: status === "CANCELLED" ? loggedOn : null,
    cancelReason: status === "CANCELLED" ? "Imported from Smartlogics" : null,
    holdStatusId: status === "PENDING" ? refs.holdId : null,
    holdReason: status === "PENDING" ? "Imported from Smartlogics" : null,
    heldAt: status === "PENDING" ? loggedOn : null,
    slaResponseDue: dues.slaResponseDue,
    slaCloseDue: dues.slaCloseDue,
    searchText: [externalRef, customer.name, phone, serial, product?.name, description].filter(Boolean).join(" ").toLowerCase(),
    createdAt: loggedOn,
  };
  if (existing) {
    const { createdAt: _createdAt, ...rest } = data;
    await prisma.complaint.update({
      where: { id: existing.id },
      data: { ...rest, searchText: [existing.ticketNumber, data.searchText].join(" ") },
    });
    await prisma.complaintEvent.create({ data: { complaintId: existing.id, type: "IMPORTED", message: "Updated from the Smartlogics import.", userId: refs.userId } });
    return "updated";
  }
  const last = await prisma.complaint.aggregate({ _max: { ticketSeq: true } });
  const ticketSeq = nextTicketSeq(last._max.ticketSeq);
  const created = await prisma.complaint.create({
    data: {
      ...data,
      ticketSeq,
      ticketNumber: formatTicket(ticketSeq),
      externalRef,
      feedbackToken: randomBytes(16).toString("hex"),
      createdById: refs.userId,
      searchText: [formatTicket(ticketSeq), data.searchText].join(" "),
    },
  });
  await prisma.complaintEvent.create({ data: { complaintId: created.id, type: "IMPORTED", message: `Imported from Smartlogics${externalRef ? ` (${externalRef})` : ""}.`, userId: refs.userId, createdAt: loggedOn } });
  return "created";
}
