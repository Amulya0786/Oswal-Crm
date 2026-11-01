import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import ExcelJS from "exceljs";
import { prisma, bumpVersion } from "./db";
import { HttpError } from "./http";
import { nextTicketNo, rememberTicket } from "./ticket-seq";
import { parseCsv } from "@/lib/csv";
import { suggestMapping, COMPLAINT_FIELDS, CUSTOMER_FIELDS, PRODUCT_FIELDS, USER_FIELDS } from "@/lib/import-map";
import { normalizeCallType, normalizePriority, normalizeSource, normalizeStatus, labelOf, STATUSES, DEFAULT_SLA_HOURS } from "@/lib/labels";
import { validateSerial } from "@/lib/quality";
import { companyCodeForCategory } from "@/lib/company-tag";
import { ensureAsset, ensureCustomer, relinkAsset } from "./link";
import { normalizePhone } from "@/lib/mask";
import { parseLooseDate } from "@/lib/time";
import type { SessionUser } from "@/lib/types";
import bcrypt from "bcryptjs";

const dir = () => path.join(process.cwd(), "data", "imports");

export async function previewImport(fileName: string, bytes: Buffer) {
  await mkdir(dir(), { recursive: true });
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const stored = path.join(dir(), token);
  await writeFile(stored, bytes);
  await writeFile(`${stored}.name`, fileName);
  const table = await readTable(stored, fileName);
  if (table.rows.length > 20000) throw new HttpError(400, "This file has more than 20,000 rows. Split it and import in parts.");
  return {
    token,
    headers: table.headers,
    sample: table.rows.slice(0, 8),
    rowCount: table.rows.length,
    mapping: suggestMapping(table.headers),
    entities: {
      complaints: COMPLAINT_FIELDS,
      customers: CUSTOMER_FIELDS,
      products: PRODUCT_FIELDS,
      users: USER_FIELDS,
    },
  };
}

async function readTable(file: string, fileName: string) {
  if (fileName.toLowerCase().endsWith(".csv")) {
    const text = await readFile(file, "utf8");
    return parseCsv(text);
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [] as string[], rows: [] as Record<string, string>[] };
  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, index) => {
    headers[index - 1] = String(cell.value ?? "").trim();
  });
  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      const value = row.getCell(index + 1).value;
      if (value instanceof Date) record[header] = value.toISOString();
      else if (value && typeof value === "object" && "text" in value) record[header] = String((value as { text: string }).text ?? "");
      else record[header] = value == null ? "" : String(value);
    });
    if (Object.values(record).some((value) => value.trim())) rows.push(record);
  });
  return { headers: headers.filter(Boolean), rows };
}

function mapped(row: Record<string, string>, mapping: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const [header, field] of Object.entries(mapping)) {
    if (!field || field === "ignore") continue;
    out[field] = row[header] ?? "";
  }
  return out;
}

export async function commitImport(user: SessionUser, input: { token: string; entity: string; mapping: Record<string, string>; companyId?: string }) {
  if (!user.caps.import) throw new HttpError(403, "You cannot import");
  const file = path.join(dir(), path.basename(input.token));
  const fileName = await readFile(`${file}.name`, "utf8").catch(() => "upload.csv");
  const table = await readTable(file, fileName);
  const rows = table.rows.map((row) => mapped(row, input.mapping));
  if (input.entity === "complaints") return importComplaints(user, rows, input.companyId);
  if (input.entity === "customers") return importCustomers(rows, input.companyId);
  if (input.entity === "products") return importProducts(rows, input.companyId);
  if (input.entity === "users") {
    if (!user.caps.security) throw new HttpError(403, "Only an admin can import users");
    return importUsers(rows, input.companyId);
  }
  throw new HttpError(400, "Choose complaints, customers, products or users");
}

async function companyForProductText(text: string) {
  const code = companyCodeForCategory(text);
  return prisma.company.findUnique({ where: { code } });
}

async function companyByCode(code?: string | null, fallback?: string) {
  if (fallback) return prisma.company.findUnique({ where: { id: fallback } });
  const wanted = (code ?? "").toUpperCase();
  if (wanted.includes("SOL")) return prisma.company.findUnique({ where: { code: "SOLAR" } });
  return prisma.company.findFirst({ where: { code: "PUMPS" } });
}

async function importComplaints(user: SessionUser, rows: Record<string, string>[], companyId?: string) {
  const states = await prisma.state.findMany({ include: { districts: { include: { areas: true } } } });
  const stateByName = new Map(states.map((state) => [state.name.toLowerCase(), state]));
  const brands = await prisma.brand.findMany();
  const products = await prisma.product.findMany();
  const engineers = await prisma.engineer.findMany();
  const issues = await prisma.complaintIssue.findMany();
  let created = 0;
  let updated = 0;
  const errors: string[] = [];
  for (const [index, row] of rows.entries()) {
    try {
      const company = await companyForProductText([row.categoryName, row.productDetails, row.schemeName].filter(Boolean).join(" "))
        ?? await companyByCode(row.companyCode, companyId);
      if (!company) throw new Error("Company is missing");
      const phone = normalizePhone(row.phone);
      if (!row.customerName || phone.length < 8) throw new Error("Customer and mobile are required");
      const state = stateByName.get((row.stateName ?? "").trim().toLowerCase());
      const district = state?.districts.find((item) => item.name.toLowerCase() === (row.districtName ?? "").trim().toLowerCase());
      const area = district?.areas.find((item) => item.name.toLowerCase() === (row.areaName ?? "").trim().toLowerCase());
      const brand = brands.find((item) => item.companyId === company.id && item.name.toLowerCase() === (row.brandName ?? "").trim().toLowerCase());
      const product = products.find((item) => item.companyId === company.id && (item.name.toLowerCase() === (row.productDetails ?? "").trim().toLowerCase() || (row.productDetails ?? "").toLowerCase().includes(item.name.toLowerCase())));
      const engineer = engineers.find((item) => item.companyId === company.id && item.name.toLowerCase() === (row.assignedName ?? "").trim().toLowerCase());
      const nature = issues.find((item) => item.name.toLowerCase() === (row.natureText ?? "").trim().toLowerCase());
      const bookDate = parseLooseDate(row.bookDate) ?? new Date();
      const status = normalizeStatus(row.status) ?? "OPEN";
      const callType = normalizeCallType(row.callType);
      const hours = DEFAULT_SLA_HOURS[callType] ?? 72;
      const serialChecked = (row.serialNo || "").trim()
        ? validateSerial(row.serialNo)
        : null;
      if (serialChecked && !serialChecked.ok) throw new Error(serialChecked.reason);
      const serialNorm = serialChecked && serialChecked.ok ? serialChecked.serial : null;
      const party = await ensureCustomer(prisma, {
        companyId: company.id,
        name: row.customerName,
        phone,
        address: row.address || null,
        stateId: state?.id,
        districtId: district?.id,
        areaId: area?.id,
        pincode: row.pincode || null,
        village: area?.name ?? row.areaName,
      });
      const customer = party.customer;
      const asset = await ensureAsset(prisma, {
        companyId: company.id,
        customerId: customer.id,
        name: row.customerName,
        phone,
        productId: product?.id,
        productName: row.productDetails || product?.name,
        modelName: product?.name || row.productDetails,
        serialNorm,
        capacityLabel: row.capacityLabel || row.hp || null,
      });
      const data = {
        companyId: company.id,
        bookDate,
        scheduleDate: parseLooseDate(row.scheduleDate),
        customerId: customer.id,
        customerName: row.customerName,
        phone,
        address: row.address || null,
        stateId: state?.id,
        districtId: district?.id,
        areaId: area?.id,
        stateName: state?.name ?? row.stateName,
        districtName: district?.name ?? row.districtName,
        areaName: area?.name ?? row.areaName,
        pincode: row.pincode || null,
        callType,
        productId: product?.id,
        productDetails: row.productDetails || product?.name,
        categoryId: product?.categoryId,
        assetId: asset.id,
        serialNo: serialNorm,
        serialNorm,
        serialPending: !(row.serialNo || "").trim(),
        serialUnavailableReason: (row.serialNo || "").trim() ? null : "OTHER",
        natureId: nature?.id,
        natureText: nature?.name ?? row.natureText,
        source: normalizeSource("call"),
        callBy: row.callBy || user.name,
        priority: normalizePriority(row.priority),
        status,
        finalStatus: row.finalStatus || labelOf(STATUSES, status),
        engineerId: engineer?.id,
        assignedName: engineer?.name ?? row.assignedName,
        assignedAt: engineer ? bookDate : null,
        brandId: brand?.id,
        brandName: brand?.name ?? row.brandName,
        saralId: row.saralId || null,
        msedclConsumerNo: row.msedclConsumerNo || null,
        msedclSubdivision: row.msedclSubdivision || null,
        schemeName: row.schemeName || null,
        slaHours: hours,
        slaDueAt: new Date(bookDate.getTime() + hours * 3600 * 1000),
        createdById: user.id,
      };
      const ticketNo = row.ticketNo?.trim();
      if (ticketNo) {
        const existing = await prisma.complaint.findUnique({ where: { ticketNo } });
        if (existing) {
          await prisma.complaint.update({ where: { id: existing.id }, data });
          updated++;
        } else {
          await prisma.complaint.create({ data: { ...data, ticketNo } });
          await rememberTicket(ticketNo);
          created++;
        }
      } else {
        const fresh = await nextTicketNo(bookDate);
        await prisma.complaint.create({ data: { ...data, ticketNo: fresh } });
        created++;
      }
      await relinkAsset(prisma, asset.id);
    } catch (error) {
      errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : "failed"}`);
    }
  }
  await bumpVersion();
  return { created, updated, errors: errors.slice(0, 20) };
}

async function importCustomers(rows: Record<string, string>[], companyId?: string) {
  let created = 0;
  const errors: string[] = [];
  for (const [index, row] of rows.entries()) {
    try {
      const company = await companyByCode(row.companyCode, companyId);
      const phone = normalizePhone(row.phone);
      if (!company || !row.customerName || phone.length < 8) throw new Error("Name, mobile and company are required");
      await prisma.customer.upsert({
        where: { companyId_phone: { companyId: company.id, phone } },
        create: { companyId: company.id, name: row.customerName, phone, phoneNorm: phone, nameNorm: row.customerName.trim().toLowerCase().replace(/\s+/g, " "), address: row.address || null, email: row.email || null, pincode: row.pincode || null, village: row.areaName?.trim().toLowerCase() || null },
        update: { name: row.customerName, address: row.address || null, email: row.email || null },
      });
      created++;
    } catch (error) {
      errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : "failed"}`);
    }
  }
  return { created, updated: 0, errors };
}

async function importProducts(rows: Record<string, string>[], companyId?: string) {
  let created = 0;
  const errors: string[] = [];
  for (const [index, row] of rows.entries()) {
    try {
      const name = row.productDetails || row.customerName;
      const company = await companyForProductText([row.categoryName, name].filter(Boolean).join(" "))
        ?? await companyByCode(row.companyCode, companyId);
      if (!company || !row.sku || !name) throw new Error("SKU, name and company are required");
      await prisma.product.upsert({
        where: { companyId_sku: { companyId: company.id, sku: row.sku } },
        create: { companyId: company.id, sku: row.sku, name, type: (row.type || "SUBMERSIBLE").toUpperCase() },
        update: { name, type: (row.type || "SUBMERSIBLE").toUpperCase() },
      });
      created++;
    } catch (error) {
      errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : "failed"}`);
    }
  }
  return { created, updated: 0, errors };
}

async function importUsers(rows: Record<string, string>[], companyId?: string) {
  let created = 0;
  const errors: string[] = [];
  for (const [index, row] of rows.entries()) {
    try {
      const email = (row.email || "").trim().toLowerCase();
      const name = row.customerName;
      if (!email || !name) throw new Error("Name and email are required");
      const company = await companyByCode(row.companyCode, companyId);
      const passwordHash = await bcrypt.hash(row.password || "Welcome@123", 8);
      const role = (row.role || "CALL_CENTRE").toUpperCase().replace(/\s+/g, "_");
      const user = await prisma.user.upsert({
        where: { email },
        create: { name, email, passwordHash, role, phone: normalizePhone(row.phone) || null },
        update: { name, role },
      });
      if (company) {
        await prisma.userCompany.upsert({ where: { userId_companyId: { userId: user.id, companyId: company.id } }, create: { userId: user.id, companyId: company.id }, update: {} });
      }
      created++;
    } catch (error) {
      errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : "failed"}`);
    }
  }
  return { created, updated: 0, errors };
}
