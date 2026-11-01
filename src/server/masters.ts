import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { HttpError } from "./http";
import type { SessionUser } from "@/lib/types";

type Field = {
  key: string;
  label: string;
  type: "text" | "number" | "bool" | "select";
  required?: boolean;
  optionsKey?: string;
};

type MasterDef = {
  key: string;
  title: string;
  group: string;
  model: string;
  companyScoped?: boolean;
  search: string[];
  fields: Field[];
  orderBy: string;
  include?: Record<string, boolean | object>;
  present: (row: any) => Record<string, string>;
};

const text = (key: string, label: string, required = false): Field => ({ key, label, type: "text", required });
const select = (key: string, label: string, optionsKey: string, required = false): Field => ({ key, label, type: "select", optionsKey, required });

export const MASTER_DEFS: MasterDef[] = [
  { key: "states", title: "States", group: "Places", model: "state", search: ["name", "code"], orderBy: "name", fields: [text("name", "State", true), text("code", "Code")], present: (row) => ({ Name: row.name, Code: row.code ?? "" }) },
  { key: "districts", title: "City / district", group: "Places", model: "district", search: ["name"], orderBy: "name", include: { state: true }, fields: [text("name", "District", true), select("stateId", "State", "states", true)], present: (row) => ({ District: row.name, State: row.state?.name ?? "" }) },
  { key: "areas", title: "Area / block", group: "Places", model: "area", search: ["name"], orderBy: "name", include: { district: { include: { state: true } } }, fields: [text("name", "Area", true), select("districtId", "District", "districts", true)], present: (row) => ({ Area: row.name, District: row.district?.name ?? "", State: row.district?.state?.name ?? "" }) },
  { key: "pincodes", title: "Pincode", group: "Places", model: "pincode", search: ["code"], orderBy: "code", include: { district: true, area: true }, fields: [text("code", "Pincode", true), select("districtId", "District", "districts", true), select("areaId", "Area", "areas")], present: (row) => ({ Pincode: row.code, District: row.district?.name ?? "", Area: row.area?.name ?? "" }) },
  { key: "categories", title: "Category", group: "Products", model: "category", search: ["name"], orderBy: "name", fields: [text("name", "Category", true)], present: (row) => ({ Category: row.name }) },
  { key: "hsn", title: "HSN code", group: "Products", model: "hsnCode", search: ["code", "description"], orderBy: "code", fields: [text("code", "HSN", true), text("description", "Description", true)], present: (row) => ({ HSN: row.code, Description: row.description }) },
  { key: "heads", title: "Pump head", group: "Products", model: "pumpHead", search: ["label"], orderBy: "label", fields: [text("label", "Head", true)], present: (row) => ({ Head: row.label }) },
  { key: "capacities", title: "HP / capacity", group: "Products", model: "hpCapacity", search: ["label"], orderBy: "label", fields: [text("label", "Capacity", true)], present: (row) => ({ Capacity: row.label }) },
  {
    key: "products", title: "Products", group: "Products", model: "product", companyScoped: true, search: ["name", "sku"], orderBy: "name",
    include: { company: true, category: true },
    fields: [select("companyId", "Company", "companies", true), text("sku", "SKU", true), text("name", "Name", true), select("categoryId", "Category", "categories"), select("hsnId", "HSN", "hsn"), select("pumpHeadId", "Head", "heads"), select("hpId", "HP", "capacities"), text("type", "Type", true), text("description", "Description")],
    present: (row) => ({ Company: row.company?.shortName ?? "", SKU: row.sku, Name: row.name, Category: row.category?.name ?? "", Type: row.type }),
  },
  {
    key: "customers", title: "Customer", group: "People", model: "customer", companyScoped: true, search: ["name", "phone"], orderBy: "name",
    include: { company: true, district: true, state: true },
    fields: [select("companyId", "Company", "companies", true), text("name", "Name", true), text("phone", "Mobile", true), text("address", "Address"), select("stateId", "State", "states"), select("districtId", "District", "districts"), text("pincode", "Pincode"), text("email", "Email")],
    present: (row) => ({ Company: row.company?.shortName ?? "", Name: row.name, Mobile: row.phone, District: row.district?.name ?? "", State: row.state?.name ?? "" }),
  },
  {
    key: "engineers", title: "Engineer / service centre", group: "People", model: "engineer", companyScoped: true, search: ["name", "phone"], orderBy: "name",
    include: { company: true, district: true },
    fields: [select("companyId", "Company", "companies", true), text("name", "Name", true), text("phone", "Mobile"), text("kind", "Type (ENGINEER or SERVICE_CENTER)", true), select("stateId", "State", "states"), select("districtId", "District", "districts"), text("pincodes", "Pincodes"), text("skills", "Skills")],
    present: (row) => ({ Company: row.company?.shortName ?? "", Name: row.name, Type: row.kind, District: row.district?.name ?? "", Pincodes: row.pincodes }),
  },
  { key: "brands", title: "OEM / brand", group: "People", model: "brand", companyScoped: true, search: ["name"], orderBy: "name", include: { company: true }, fields: [select("companyId", "Company", "companies", true), text("name", "Brand", true)], present: (row) => ({ Company: row.company?.shortName ?? "", Brand: row.name }) },
  { key: "expenses", title: "Expense types", group: "Complaint setup", model: "expenseType", search: ["name"], orderBy: "name", fields: [text("name", "Expense type", true)], present: (row) => ({ "Expense type": row.name }) },
  { key: "issues", title: "Complaint issue", group: "Complaint setup", model: "complaintIssue", search: ["name"], orderBy: "name", fields: [text("name", "Nature of complaint", true)], present: (row) => ({ Nature: row.name }) },
  { key: "sources", title: "Complaint source", group: "Complaint setup", model: "complaintSource", search: ["name", "code"], orderBy: "name", fields: [text("code", "Code", true), text("name", "Source", true)], present: (row) => ({ Code: row.code, Source: row.name }) },
  { key: "holds", title: "Complaint hold status", group: "Complaint setup", model: "holdStatus", search: ["name"], orderBy: "name", fields: [text("name", "Hold reason", true)], present: (row) => ({ "Hold reason": row.name }) },
  { key: "checklist", title: "Check list", group: "Complaint setup", model: "checkItem", search: ["name"], orderBy: "sort", fields: [text("name", "Item", true), { key: "sort", label: "Sort", type: "number" }], present: (row) => ({ Item: row.name, Sort: String(row.sort) }) },
  { key: "problems", title: "Actual problem", group: "Complaint setup", model: "actualProblem", search: ["name"], orderBy: "name", fields: [text("name", "Problem", true)], present: (row) => ({ Problem: row.name }) },
  { key: "solutions", title: "Actual solution", group: "Complaint setup", model: "actualSolution", search: ["name"], orderBy: "name", fields: [text("name", "Solution", true)], present: (row) => ({ Solution: row.name }) },
  {
    key: "beneficiaries", title: "Beneficiary data", group: "Complaint setup", model: "beneficiary", companyScoped: true, search: ["name", "phone", "saralId"], orderBy: "name",
    include: { company: true },
    fields: [select("companyId", "Company", "companies", true), text("name", "Name", true), text("phone", "Mobile"), text("saralId", "Saral Id"), text("districtName", "District"), text("scheme", "Scheme"), text("notes", "Notes")],
    present: (row) => ({ Company: row.company?.shortName ?? "", Name: row.name, Mobile: row.phone ?? "", "Saral Id": row.saralId ?? "", Scheme: row.scheme ?? "" }),
  },
];

function model(name: string) {
  return (prisma as unknown as Record<string, any>)[name];
}

export function masterDef(key: string) {
  return MASTER_DEFS.find((item) => item.key === key) ?? null;
}

function whereFor(def: MasterDef, q?: string, companyId?: string) {
  const where: Record<string, unknown> = {};
  if (def.companyScoped && companyId && companyId !== "all") where.companyId = companyId;
  if (q && q.trim()) {
    where.OR = def.search.map((field) => ({ [field]: { contains: q.trim(), mode: "insensitive" } }));
  }
  return where;
}

export async function listMaster(def: MasterDef, q?: string, page = 1, companyId?: string) {
  const take = 25;
  const skip = (Math.max(1, page) - 1) * take;
  const where = whereFor(def, q, companyId);
  const [total, rows] = await Promise.all([
    model(def.model).count({ where }),
    model(def.model).findMany({ where, include: def.include, orderBy: { [def.orderBy]: "asc" }, skip, take }),
  ]);
  return {
    title: def.title,
    fields: def.fields,
    columns: Object.keys(def.present(rows[0] ?? {})),
    rows: rows.map((row: any) => ({ id: row.id as string, cells: def.present(row), raw: pickRaw(def, row) })),
    total,
    page: Math.max(1, page),
    pageSize: take,
  };
}

function pickRaw(def: MasterDef, row: any) {
  const raw: Record<string, string | number | boolean | null> = {};
  for (const field of def.fields) raw[field.key] = row[field.key] ?? (field.type === "bool" ? false : "");
  return raw;
}

export async function saveMaster(user: SessionUser, def: MasterDef, input: Record<string, unknown>, id?: string) {
  if (!user.caps.masterWrite) throw new HttpError(403, "Only an admin can change masters");
  const data: Record<string, unknown> = {};
  for (const field of def.fields) {
    const value = input[field.key];
    if (field.type === "number") data[field.key] = value === "" || value == null ? 0 : Number(value);
    else if (field.type === "bool") data[field.key] = Boolean(value);
    else if (value === "" || value == null) data[field.key] = null;
    else data[field.key] = String(value).trim();
    if (field.required && (data[field.key] == null || data[field.key] === "")) throw new HttpError(400, `${field.label} is required`);
  }
  if (def.key === "customers" && typeof data.phone === "string") data.phone = data.phone.replace(/\D/g, "").slice(-10);
  if (def.key === "engineers" && !data.kind) data.kind = "ENGINEER";
  try {
    const saved = id ? await model(def.model).update({ where: { id }, data }) : await model(def.model).create({ data });
    await prisma.auditLog.create({
      data: { userId: user.id, entity: def.model, entityId: saved.id, action: id ? "UPDATE" : "CREATE", summary: `${def.title} ${id ? "updated" : "created"}` },
    });
    return saved;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new HttpError(400, "That value already exists");
    throw error;
  }
}

export async function deleteMaster(user: SessionUser, def: MasterDef, id: string) {
  if (!user.caps.masterWrite) throw new HttpError(403, "Only an admin can change masters");
  try {
    await model(def.model).delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      throw new HttpError(400, "This record is still used by complaints or other masters");
    }
    throw error;
  }
}

export async function masterOptions() {
  const [companies, states, districts, areas, categories, hsn, heads, capacities] = await Promise.all([
    prisma.company.findMany({ orderBy: { code: "asc" } }),
    prisma.state.findMany({ orderBy: { name: "asc" } }),
    prisma.district.findMany({ orderBy: { name: "asc" }, include: { state: true } }),
    prisma.area.findMany({ orderBy: { name: "asc" }, take: 500 }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.hsnCode.findMany({ orderBy: { code: "asc" } }),
    prisma.pumpHead.findMany({ orderBy: { label: "asc" } }),
    prisma.hpCapacity.findMany({ orderBy: { label: "asc" } }),
  ]);
  return {
    companies: companies.map((row) => ({ value: row.id, label: row.shortName })),
    states: states.map((row) => ({ value: row.id, label: row.name })),
    districts: districts.map((row) => ({ value: row.id, label: `${row.name}, ${row.state.name}` })),
    areas: areas.map((row) => ({ value: row.id, label: row.name })),
    categories: categories.map((row) => ({ value: row.id, label: row.name })),
    hsn: hsn.map((row) => ({ value: row.id, label: row.code })),
    heads: heads.map((row) => ({ value: row.id, label: row.label })),
    capacities: capacities.map((row) => ({ value: row.id, label: row.label })),
  };
}
