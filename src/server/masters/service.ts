import * as xlsx from "xlsx";
import { prisma } from "@/lib/prisma";
import { AppError, wrapPrisma } from "@/lib/errors";
import { applyMapping, suggestMapping } from "@/lib/import/targets";
import { isMobile, normalizePhone } from "@/lib/phone";
import type { MasterField } from "./registry";
import { getMaster } from "./registry";
import { audit } from "../audit";

type Delegate = {
  findMany: (args?: object) => Promise<Record<string, unknown>[]>;
  findUnique: (args: object) => Promise<Record<string, unknown> | null>;
  create: (args: object) => Promise<Record<string, unknown>>;
  update: (args: object) => Promise<Record<string, unknown>>;
  delete: (args: object) => Promise<Record<string, unknown>>;
};

function model(name: string): Delegate {
  const delegate = (prisma as unknown as Record<string, Delegate>)[name];
  if (!delegate) throw new AppError("Unknown data model.");
  return delegate;
}

function includeFor(fields: MasterField[]) {
  const include: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.type !== "relation" || !field.relation) continue;
    include[field.relation.name] = { select: { id: true, [field.relation.label]: true } };
  }
  return include;
}

function applyNormalize(field: MasterField, value: unknown) {
  if (!field.normalize || value === null || value === undefined || value === "") return value;
  const text = String(value);
  if (field.normalize === "upper") return text.trim().toUpperCase();
  if (field.normalize === "digits") return text.replace(/\D/g, "");
  if (field.normalize === "phone") return normalizePhone(text);
  return value;
}

export function pickFields(entity: string, body: Record<string, unknown>, mode: "create" | "update") {
  const master = getMaster(entity);
  const data: Record<string, unknown> = {};
  for (const field of master.fields) {
    if (!(field.key in body) || body[field.key] === undefined) {
      if (mode === "create" && field.required) throw new AppError(`${field.label} is required.`);
      if (mode === "create" && field.type === "boolean") data[field.key] = field.key !== "isDefault";
      continue;
    }
    let value = body[field.key];
    if (typeof value === "string") value = value.trim();
    if (value === "" || value === null) {
      if (field.required) throw new AppError(`${field.label} is required.`);
      data[field.key] = field.type === "boolean" ? false : null;
      continue;
    }
    if (field.type === "number") {
      const parsed = Number(value);
      if (Number.isNaN(parsed)) throw new AppError(`${field.label} must be a number.`);
      data[field.key] = parsed;
    } else if (field.type === "boolean") {
      data[field.key] = value === true || value === "true" || value === "Yes" || value === "yes" || value === 1 || value === "1" || value === "on";
    } else if (field.type === "select") {
      const choice = String(value);
      if (field.options && !field.options.some((option) => option.value === choice)) {
        throw new AppError(`${field.label} is not a valid choice.`);
      }
      data[field.key] = choice;
    } else {
      data[field.key] = applyNormalize(field, String(value));
    }
  }
  if (master.model === "customer" && data.phone && !isMobile(String(data.phone))) {
    throw new AppError("Enter a 10-digit Indian mobile number.");
  }
  if (master.model === "customer") {
    data.searchText = [data.name, data.phone, data.email, data.village, data.address].filter(Boolean).join(" ").toLowerCase();
  }
  if (master.model === "product" && data.warrantyMonths === undefined && mode === "create") data.warrantyMonths = 12;
  if ((master.model === "product" || master.model === "expenseType" || master.model === "complaintIssue" || master.model === "complaintSource" || master.model === "holdStatus" || master.model === "checkListItem" || master.model === "actualProblem" || master.model === "actualSolution" || master.model === "serviceCenter") && mode === "create" && data.active === undefined) {
    data.active = true;
  }
  return data;
}

async function resolveRelations(entity: string, data: Record<string, unknown>) {
  const master = getMaster(entity);
  for (const field of master.fields) {
    if (field.type !== "relation" || !field.relation) continue;
    const value = data[field.key];
    if (!value) continue;
    const delegate = model(field.relation.model);
    const byId = await delegate.findUnique({ where: { id: String(value) } });
    if (byId) continue;
    const rows = await delegate.findMany({ take: 1000 });
    const match = rows.find((row) => String(row[field.relation!.label] ?? "").toLowerCase() === String(value).toLowerCase());
    if (!match) throw new AppError(`${field.label} "${value}" was not found.`);
    data[field.key] = match.id;
  }
}

export async function listMaster(entity: string, query: string, page: number) {
  const master = getMaster(entity);
  const pageSize = 15;
  const rows = await model(master.model).findMany({
    include: includeFor(master.fields),
    orderBy: master.orderBy,
  });
  const needle = query.trim().toLowerCase();
  const filtered = needle ? rows.filter((row) => JSON.stringify(row).toLowerCase().includes(needle)) : rows;
  const start = (page - 1) * pageSize;
  return { rows: filtered.slice(start, start + pageSize), total: filtered.length, page, pageSize };
}

export async function createMaster(entity: string, body: Record<string, unknown>, userId: string) {
  const master = getMaster(entity);
  const data = pickFields(entity, body, "create");
  await resolveRelations(entity, data);
  try {
    const created = await model(master.model).create({ data });
    await audit({ entity: master.model, entityId: String(created.id), action: "create", userId, changes: data });
    return created;
  } catch (error) {
    wrapPrisma(error);
  }
}

export async function updateMaster(entity: string, id: string, body: Record<string, unknown>, userId: string) {
  const master = getMaster(entity);
  const data = pickFields(entity, body, "update");
  await resolveRelations(entity, data);
  if (master.model === "customer") {
    const existing = await model(master.model).findUnique({ where: { id } });
    if (!existing) throw new AppError("Record not found.", 404);
    data.searchText = [data.name ?? existing.name, data.phone ?? existing.phone, data.email ?? existing.email, data.village ?? existing.village, data.address ?? existing.address]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }
  try {
    const updated = await model(master.model).update({ where: { id }, data });
    await audit({ entity: master.model, entityId: id, action: "update", userId, changes: data });
    return updated;
  } catch (error) {
    wrapPrisma(error);
  }
}

export async function deleteMaster(entity: string, id: string, userId: string) {
  const master = getMaster(entity);
  try {
    await model(master.model).delete({ where: { id } });
    await audit({ entity: master.model, entityId: id, action: "delete", userId });
  } catch (error) {
    wrapPrisma(error);
  }
}

export async function importMaster(entity: string, buffer: Buffer, userId: string) {
  const master = getMaster(entity);
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new AppError("The file has no sheet.");
  const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (rows.length === 0) throw new AppError("The file has no data rows.");
  if (rows.length > 5000) throw new AppError("Import a maximum of 5000 rows at a time.");
  const headers = Object.keys(rows[0]);
  const mapping = suggestMapping(
    headers,
    master.fields.map((field) => ({ key: field.key, label: field.label, required: field.required, synonyms: [field.label, field.key] })),
  );
  let created = 0;
  const failed: { row: number; error: string }[] = [];
  for (let index = 0; index < rows.length; index++) {
    try {
      await createMaster(entity, applyMapping(rows[index], mapping), userId);
      created++;
    } catch (error) {
      failed.push({ row: index + 2, error: error instanceof Error ? error.message : "Could not import this row." });
    }
  }
  await audit({ entity: master.model, action: "import", userId, changes: { created, failed: failed.length } });
  return { created, failed: failed.slice(0, 30), failedCount: failed.length, mapping };
}

export async function optionList(modelName: string, label: string, filters: Record<string, string>) {
  const rows = await model(modelName).findMany({ take: 1000 });
  return rows
    .filter((row) => {
      for (const [key, value] of Object.entries(filters)) {
        if (!value) continue;
        if (String(row[key] ?? "") !== value) return false;
      }
      return true;
    })
    .map((row) => ({ id: String(row.id), label: String(row[label] ?? row.id) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
