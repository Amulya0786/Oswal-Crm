export type ImportField = {
  key: string;
  label: string;
  required?: boolean;
  synonyms: string[];
};

export type ImportEntity = "complaints" | "customers" | "products" | "users";

export const IMPORT_TARGETS: Record<ImportEntity, { label: string; fields: ImportField[] }> = {
  complaints: {
    label: "Complaints",
    fields: [
      { key: "externalRef", label: "Legacy ticket no.", synonyms: ["complaint no", "ticket", "ticket no", "docket no", "call no", "complaint number"] },
      { key: "loggedOn", label: "Logged on", synonyms: ["call date", "logged on", "complaint date", "date", "created on", "log date"] },
      { key: "customerName", label: "Customer name", required: true, synonyms: ["customer", "customer name", "farmer name", "beneficiary"] },
      { key: "phone", label: "Mobile", required: true, synonyms: ["mobile", "mobile no", "phone", "contact no", "mobile number", "contact"] },
      { key: "serialNumber", label: "Serial number", synonyms: ["serial", "serial number", "serial no", "pump serial"] },
      { key: "product", label: "Product", synonyms: ["product", "product name", "item", "model"] },
      { key: "type", label: "Complaint type", required: true, synonyms: ["call type", "complaint type", "type", "nature of call"] },
      { key: "source", label: "Source", synonyms: ["source", "complaint source", "call source"] },
      { key: "issue", label: "Issue", synonyms: ["problem", "issue", "complaint issue", "nature", "nature of complaint"] },
      { key: "state", label: "State", required: true, synonyms: ["state", "state name"] },
      { key: "district", label: "District", required: true, synonyms: ["district", "district name", "city", "city district"] },
      { key: "pincode", label: "Pincode", synonyms: ["pincode", "pin", "pin code", "postal code"] },
      { key: "description", label: "Description", synonyms: ["narration", "remarks", "description", "complaint details", "comment"] },
      { key: "status", label: "Status", synonyms: ["status", "call status"] },
      { key: "scheme", label: "Scheme", synonyms: ["scheme", "scheme name"] },
      { key: "consumerNumber", label: "Consumer number", synonyms: ["consumer number", "consumer no", "beneficiary id"] },
    ],
  },
  customers: {
    label: "Customers",
    fields: [
      { key: "customerName", label: "Customer name", required: true, synonyms: ["name", "customer", "customer name"] },
      { key: "phone", label: "Mobile", required: true, synonyms: ["mobile", "mobile no", "phone", "contact"] },
      { key: "email", label: "Email", synonyms: ["email", "email id"] },
      { key: "address", label: "Address", synonyms: ["address", "village address"] },
      { key: "village", label: "Village", synonyms: ["village", "town"] },
      { key: "state", label: "State", synonyms: ["state", "state name"] },
      { key: "district", label: "District", synonyms: ["district", "district name", "city"] },
      { key: "pincode", label: "Pincode", synonyms: ["pincode", "pin code"] },
      { key: "serialNumber", label: "Serial number", synonyms: ["serial", "serial number", "serial no"] },
    ],
  },
  products: {
    label: "Products",
    fields: [
      { key: "sku", label: "SKU", required: true, synonyms: ["sku", "item code", "product code", "code"] },
      { key: "name", label: "Product name", required: true, synonyms: ["product", "product name", "name", "item"] },
      { key: "family", label: "Family", synonyms: ["family", "product family", "category type"] },
      { key: "brand", label: "Brand", synonyms: ["brand", "oem", "oem brand"] },
      { key: "category", label: "Category", synonyms: ["category"] },
      { key: "hsn", label: "HSN", synonyms: ["hsn", "hsn code"] },
      { key: "hp", label: "HP", synonyms: ["hp", "capacity", "hp capacity"] },
      { key: "head", label: "Head", synonyms: ["head", "pump head", "head metres"] },
      { key: "warrantyMonths", label: "Warranty months", synonyms: ["warranty", "warranty months"] },
    ],
  },
  users: {
    label: "Users",
    fields: [
      { key: "name", label: "Name", required: true, synonyms: ["name", "employee", "user name"] },
      { key: "email", label: "Email", required: true, synonyms: ["email", "email id", "user id"] },
      { key: "role", label: "Role", required: true, synonyms: ["role", "user role"] },
      { key: "phone", label: "Mobile", synonyms: ["mobile", "phone", "mobile no"] },
      { key: "employeeCode", label: "Employee code", synonyms: ["employee code", "emp code", "user code"] },
      { key: "password", label: "Password", synonyms: ["password"] },
      { key: "state", label: "States", synonyms: ["state", "states", "state name"] },
      { key: "district", label: "Districts", synonyms: ["district", "districts", "district name"] },
      { key: "brand", label: "Brands", synonyms: ["brand", "brands", "oem"] },
    ],
  },
};

export function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function suggestMapping(headers: string[], fields: ImportField[]) {
  const mapping: Record<string, string> = {};
  const used = new Set<string>();
  const scored: { field: string; header: string; score: number }[] = [];
  for (const field of fields) {
    const names = [field.key, field.label, ...field.synonyms].map(normalizeHeader).filter(Boolean);
    for (const header of headers) {
      const normalized = normalizeHeader(header);
      if (!normalized) continue;
      let score = 0;
      if (names.includes(normalized)) score = 100;
      else if (names.some((name) => name.length > 2 && (normalized.includes(name) || name.includes(normalized)))) score = 60;
      if (score) scored.push({ field: field.key, header, score });
    }
  }
  scored.sort((a, b) => b.score - a.score || b.header.length - a.header.length);
  for (const row of scored) {
    if (mapping[row.field] || used.has(row.header)) continue;
    mapping[row.field] = row.header;
    used.add(row.header);
  }
  return mapping;
}

export function applyMapping(row: Record<string, unknown>, mapping: Record<string, string>) {
  const out: Record<string, unknown> = {};
  for (const [field, header] of Object.entries(mapping)) {
    if (!header) continue;
    const value = row[header];
    if (value === undefined || value === null || value === "") continue;
    out[field] = value;
  }
  return out;
}

export function cellString(value: unknown) {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

export function excelDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const utc = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
    return Number.isNaN(utc.getTime()) ? null : utc;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}
