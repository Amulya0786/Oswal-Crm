import path from "path";
import { prisma, bumpVersion } from "./db";
import { HttpError } from "./http";
import { nextTicketNo, rememberTicket } from "./ticket-seq";
import { parseCsv } from "@/lib/csv";
import { suggestMapping, COMPLAINT_FIELDS, CUSTOMER_FIELDS, PRODUCT_FIELDS, USER_FIELDS } from "@/lib/import-map";
import { normalizeCallType, normalizePriority, normalizeSource, labelOf, STATUSES, DEFAULT_SLA_HOURS, FIRST_CONTACT_HOURS } from "@/lib/labels";
import { validateSerial } from "@/lib/quality";
import { companyCodeForCategory } from "@/lib/company-tag";
import { ensureAsset, ensureCustomer, relinkAsset } from "./link";
import { normalizePhone } from "@/lib/mask";
import { parseLooseDate } from "@/lib/time";
import { IMPORT_BATCH, classifyHistoryDate, openImportStatus, resolveHistoryCutoff, tallyHistory } from "@/lib/import-cutoff";
import type { SessionUser } from "@/lib/types";
import bcrypt from "bcryptjs";
import { loadObject, saveObject } from "./storage";

export async function previewImport(fileName: string, bytes: Buffer) {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await saveObject(`imports/${token}`, bytes, "application/octet-stream");
  await saveObject(`imports/${token}.name`, Buffer.from(fileName), "text/plain");
  const table = await readTableBytes(bytes, fileName);
  if (table.rows.length > 100000) throw new HttpError(400, "This file has more than 100,000 rows.");
  const mapping = suggestMapping(table.headers);
  const cutoff = resolveHistoryCutoff(undefined, process.env.IMPORT_CUTOFF);
  const bookHeader = Object.entries(mapping).find(([, field]) => field === "bookDate")?.[0];
  const dates = tallyHistory(bookHeader ? table.rows.map((row) => row[bookHeader]) : [], cutoff);
  return {
    token,
    headers: table.headers,
    sample: table.rows.slice(0, 8),
    rowCount: table.rows.length,
    cutoff: process.env.IMPORT_CUTOFF || "2026-04-01",
    eligible: bookHeader ? dates.keep : table.rows.length,
    skipped: bookHeader ? dates.skipped : 0,
    undated: bookHeader ? dates.undated : 0,
    mapping,
    entities: {
      complaints: COMPLAINT_FIELDS,
      customers: CUSTOMER_FIELDS,
      products: PRODUCT_FIELDS,
      users: USER_FIELDS,
    },
  };
}

async function readTableBytes(bytes: Buffer, fileName: string) {
  if (fileName.toLowerCase().endsWith(".csv")) return parseCsv(bytes.toString("utf8"));
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as import("exceljs").Buffer);
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
    const incoming = row[header] ?? "";
    if (field === "serialNo") {
      const productSerial = header.toLowerCase().includes("product");
      if (!out.serialNo?.trim() || (productSerial && incoming.trim())) out.serialNo = incoming;
      continue;
    }
    if (!out[field]?.trim() || incoming.trim()) out[field] = incoming;
  }
  return out;
}

export async function commitImport(user: SessionUser, input: { token: string; entity: string; mapping: Record<string, string>; companyId?: string; cutoff?: string }) {
  if (!user.caps.import) throw new HttpError(403, "You cannot import");
  const token = path.basename(input.token);
  const fileName = await loadObject(`imports/${token}.name`).then((bytes) => bytes.toString("utf8")).catch(() => "upload.csv");
  let fileBytes: Buffer | null = await loadObject(`imports/${token}`);
  const table = await readTableBytes(fileBytes, fileName);
  fileBytes = null;
  const rows = table.rows.map((row) => mapped(row, input.mapping));
  if (input.entity === "complaints") {
    await prisma.appSetting.upsert({ where: { key: "importRunning" }, create: { key: "importRunning", value: "1" }, update: { value: "1" } });
    try {
      return await importComplaints(user, rows, input.companyId, resolveHistoryCutoff(input.cutoff, process.env.IMPORT_CUTOFF));
    } finally {
      await prisma.appSetting.upsert({ where: { key: "importRunning" }, create: { key: "importRunning", value: "0" }, update: { value: "0" } });
    }
  }
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

async function ensurePlace(stateByName: Map<string, any>, stateName?: string, districtName?: string) {
  const stateLabel = (stateName ?? "").trim();
  const districtLabel = (districtName ?? "").trim();
  let state = stateLabel ? stateByName.get(stateLabel.toLowerCase()) : undefined;
  if (stateLabel && !state) {
    const created = await prisma.state.create({ data: { name: stateLabel } });
    state = { ...created, districts: [] };
    stateByName.set(stateLabel.toLowerCase(), state);
  }
  let district = state?.districts.find((item: { name: string }) => item.name.toLowerCase() === districtLabel.toLowerCase());
  if (state && districtLabel && !district) {
    const alias = await prisma.placeAlias.findFirst({ where: { kind: "district", stateName: state.name, alias: { equals: districtLabel, mode: "insensitive" } } });
    if (alias) {
      district = state.districts.find((item: { id: string }) => item.id === alias.districtId);
      if (!district) {
        const found = await prisma.district.findUnique({ where: { id: alias.districtId }, select: { id: true, name: true, stateId: true } });
        if (found) {
          district = found;
          state.districts.push(found);
        }
      }
    }
  }
  if (state && districtLabel && !district) {
    const created = await prisma.district.create({ data: { name: districtLabel, stateId: state.id } });
    district = { ...created, areas: [] };
    state.districts.push(district);
  }
  return { state, district };
}

async function importComplaints(user: SessionUser, rows: Record<string, string>[], companyId: string | undefined, cutoff: Date) {
  const states = await prisma.state.findMany({ select: { id: true, name: true, districts: { select: { id: true, name: true } } } });
  const stateByName = new Map(states.map((state) => [state.name.toLowerCase(), state]));
  const brands = await prisma.brand.findMany();
  const products = await prisma.product.findMany();
  const engineers = await prisma.engineer.findMany();
  const issues = await prisma.complaintIssue.findMany();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let undated = 0;
  const errors: string[] = [];
  const assetIds = new Set<string>();
  const areaCache = new Map<string, { id: string; name: string } | null>();
  const companyCache = new Map<string, Awaited<ReturnType<typeof companyByCode>>>();
  for (let start = 0; start < rows.length; start += IMPORT_BATCH) {
    const batch = rows.slice(start, start + IMPORT_BATCH);
    for (let offset = 0; offset < batch.length; offset++) {
    const index = start + offset;
    const row = batch[offset];
    const bookDate = parseLooseDate(row.bookDate);
    const decision = classifyHistoryDate(bookDate, cutoff);
    if (decision === "before-cutoff") {
      skipped++;
      continue;
    }
    if (decision === "no-date" || !bookDate) {
      undated++;
      errors.push(`Row ${index + 2}: Book date is missing or not DD-Mon-YYYY`);
      continue;
    }
    try {
      const companyKey = [row.categoryName, row.productDetails, row.schemeName, row.companyCode, companyId].join("|");
      let company = companyCache.get(companyKey);
      if (company === undefined) {
        company = await companyForProductText([row.categoryName, row.productDetails, row.schemeName, row.requestSubtype].filter(Boolean).join(" "))
          ?? await companyByCode(row.companyCode, companyId);
        companyCache.set(companyKey, company);
      }
      if (!company) throw new Error("Company is missing");
      const phone = normalizePhone(row.phone);
      if (!row.customerName || phone.length < 8) throw new Error("Customer and mobile are required");
      const placed = await ensurePlace(stateByName, row.stateName, row.districtName);
      const state = placed.state;
      const district = placed.district;
      const areaName = (row.areaName ?? "").trim();
      let area = district?.areas?.find((item: { name: string }) => item.name.toLowerCase() === areaName.toLowerCase()) ?? null;
      if (!area && district && areaName) {
        const key = `${district.id}|${areaName.toLowerCase()}`;
        if (!areaCache.has(key)) {
          areaCache.set(key, await prisma.area.findFirst({ where: { districtId: district.id, name: { equals: areaName, mode: "insensitive" } }, select: { id: true, name: true } }));
        }
        area = areaCache.get(key) ?? null;
      }
      let brand = brands.find((item) => item.companyId === company.id && item.name.toLowerCase() === (row.brandName ?? "").trim().toLowerCase());
      const brandName = (row.brandName ?? "").trim();
      if (brandName && !brand) {
        brand = await prisma.brand.create({ data: { companyId: company.id, name: brandName } });
        brands.push(brand);
      }
      let product = products.find((item) => item.companyId === company.id && (item.name.toLowerCase() === (row.productDetails ?? "").trim().toLowerCase() || (row.productDetails ?? "").toLowerCase().includes(item.name.toLowerCase())));
      const productName = (row.productDetails ?? "").trim();
      if (productName && !product) {
        const sku = `IMP-${productName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`;
        product = await prisma.product.upsert({
          where: { companyId_sku: { companyId: company.id, sku } },
          create: { companyId: company.id, name: productName, sku, type: "IMPORTED" },
          update: {},
        });
        products.push(product);
      }
      const assignedName = (row.assignedName || row.autoAssigned || "").trim();
      const employeeCode = (row.employeeCode || "").trim();
      let engineer = engineers.find((item) => employeeCode && item.employeeCode?.toLowerCase() === employeeCode.toLowerCase())
        ?? engineers.find((item) => assignedName && item.companyId === company.id && item.name.toLowerCase() === assignedName.toLowerCase());
      if (!engineer && (assignedName || employeeCode)) {
        engineer = await prisma.engineer.create({
          data: {
            companyId: company.id,
            name: assignedName || employeeCode,
            employeeCode: employeeCode || null,
            kind: "ENGINEER",
            stateId: state?.id ?? null,
            districtId: district?.id ?? null,
          },
        });
        engineers.push(engineer);
      }
      let nature = issues.find((item) => item.name.toLowerCase() === (row.natureText ?? "").trim().toLowerCase());
      const natureName = (row.natureText ?? "").trim();
      if (natureName && !nature) {
        nature = await prisma.complaintIssue.create({ data: { name: natureName } });
        issues.push(nature);
      }
      const categoryName = (row.categoryName ?? "").trim();
      if (categoryName) {
        const existingCategory = await prisma.category.findUnique({ where: { name: categoryName } });
        if (!existingCategory) await prisma.category.create({ data: { name: categoryName, companyCode: company.code } });
      }
      const history = openImportStatus(row.status);
      const status = history.status;
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
        altPhone: row.altPhone || null,
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
        altPhone: row.altPhone ? normalizePhone(row.altPhone) : null,
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
        closedAt: history.closed ? bookDate : null,
        happyAt: history.happy ? bookDate : null,
        happyRating: /^[1-5]$/.test((row.happyCode || "").trim()) ? Number(row.happyCode) : null,
        happyRemarks: row.happyCode && !/^[1-5]$/.test(row.happyCode.trim()) ? row.happyCode.trim() : null,
        holdReason: row.pendingReason || null,
        actualProblem: row.actualProblem || null,
        actualSolution: row.actualSolution || null,
        problemNote: [row.customerRemark, row.technicianRemark, row.technicianAction, row.msedclRequestStatus, row.requestSubtype].filter(Boolean).join(" · ") || null,
        engineerId: engineer?.id,
        assignedName: engineer?.name ?? assignedName,
        assignedAt: engineer ? bookDate : null,
        brandId: brand?.id,
        brandName: brand?.name ?? row.brandName,
        saralId: row.saralId || null,
        msedclConsumerNo: row.msedclConsumerNo || null,
        msedclSubdivision: row.msedclSubdivision || null,
        schemeName: row.schemeName || null,
        slaHours: hours,
        slaDueAt: new Date(bookDate.getTime() + hours * 3600 * 1000),
        callbackDueAt: new Date(bookDate.getTime() + FIRST_CONTACT_HOURS * 3600 * 1000),
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
      assetIds.add(asset.id);
    } catch (error) {
      errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : "failed"}`);
    }
    }
  }
  const linked = [...assetIds];
  for (let start = 0; start < linked.length; start += IMPORT_BATCH) {
    const slice = linked.slice(start, start + IMPORT_BATCH);
    for (const assetId of slice) await relinkAsset(prisma, assetId);
  }
  await bumpVersion();
  return { created, updated, skipped, undated, cutoff: cutoff.toISOString(), errors: errors.slice(0, 20) };
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
