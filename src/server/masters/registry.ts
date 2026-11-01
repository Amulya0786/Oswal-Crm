import { AppError } from "@/lib/errors";
import { COMPLAINT_TYPES, PRODUCT_FAMILIES, SCHEMES } from "@/lib/constants";
import type { FieldType, MasterDefDTO, MasterFieldDTO } from "@/lib/master-types";

type Relation = { name: string; model: string; label: string; parentKey?: string };

export type MasterField = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  relation?: Relation;
  fullWidth?: boolean;
  normalize?: "phone" | "upper" | "digits";
};

export type MasterDef = {
  key: string;
  label: string;
  group: string;
  blurb: string;
  model: string;
  orderBy: Record<string, "asc" | "desc">;
  columns: string[];
  fields: MasterField[];
};

const typeOptions = COMPLAINT_TYPES.map((item) => ({ value: item.value, label: item.label }));
const schemeOptions = SCHEMES.map((item) => ({ value: item.value, label: item.label }));
const familyOptions = PRODUCT_FAMILIES.map((item) => ({ value: item.value, label: item.label }));

export const MASTERS: MasterDef[] = [
  {
    key: "states",
    label: "States",
    group: "Geography",
    blurb: "States and union territories used on complaints and permissions.",
    model: "state",
    orderBy: { name: "asc" },
    columns: ["name", "code"],
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "code", label: "Code", type: "text", required: true, normalize: "upper" },
    ],
  },
  {
    key: "districts",
    label: "City / District",
    group: "Geography",
    blurb: "Districts and cities, each linked to a state.",
    model: "district",
    orderBy: { name: "asc" },
    columns: ["name", "stateId"],
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "stateId", label: "State", type: "relation", required: true, relation: { name: "state", model: "state", label: "name" } },
    ],
  },
  {
    key: "areas",
    label: "Area / Block",
    group: "Geography",
    blurb: "Blocks and local areas inside a district.",
    model: "area",
    orderBy: { name: "asc" },
    columns: ["name", "districtId"],
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "districtId", label: "District", type: "relation", required: true, relation: { name: "district", model: "district", label: "name" } },
    ],
  },
  {
    key: "pincodes",
    label: "Pincode",
    group: "Geography",
    blurb: "Pincodes drive automatic assignment to a service centre.",
    model: "pincode",
    orderBy: { code: "asc" },
    columns: ["code", "districtId", "areaId", "serviceCenterId"],
    fields: [
      { key: "code", label: "Pincode", type: "text", required: true, normalize: "digits" },
      { key: "stateId", label: "State", type: "relation", required: true, relation: { name: "state", model: "state", label: "name" } },
      { key: "districtId", label: "District", type: "relation", required: true, relation: { name: "district", model: "district", label: "name", parentKey: "stateId" } },
      { key: "areaId", label: "Area", type: "relation", relation: { name: "area", model: "area", label: "name", parentKey: "districtId" } },
      { key: "serviceCenterId", label: "Service centre", type: "relation", relation: { name: "serviceCenter", model: "serviceCenter", label: "name" } },
    ],
  },
  {
    key: "categories",
    label: "Category",
    group: "Catalogue",
    blurb: "Product categories used on category-wise reports.",
    model: "category",
    orderBy: { name: "asc" },
    columns: ["name"],
    fields: [{ key: "name", label: "Name", type: "text", required: true }],
  },
  {
    key: "hsn-codes",
    label: "HSN Code",
    group: "Catalogue",
    blurb: "HSN codes and GST rates for pumps and motors.",
    model: "hsnCode",
    orderBy: { code: "asc" },
    columns: ["code", "description", "gstRate"],
    fields: [
      { key: "code", label: "HSN code", type: "text", required: true },
      { key: "description", label: "Description", type: "text" },
      { key: "gstRate", label: "GST %", type: "number" },
    ],
  },
  {
    key: "brands",
    label: "OEM / Brand",
    group: "Catalogue",
    blurb: "Oswal lines and any OEM brand a user is allowed to see.",
    model: "brand",
    orderBy: { name: "asc" },
    columns: ["name", "code"],
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "code", label: "Code", type: "text", required: true, normalize: "upper" },
    ],
  },
  {
    key: "pump-heads",
    label: "Pump Head",
    group: "Catalogue",
    blurb: "Rated head in metres.",
    model: "pumpHead",
    orderBy: { metres: "asc" },
    columns: ["name", "metres"],
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "metres", label: "Metres", type: "number", required: true },
    ],
  },
  {
    key: "hp-capacities",
    label: "HP / Capacity",
    group: "Catalogue",
    blurb: "Horsepower ratings.",
    model: "hpCapacity",
    orderBy: { hp: "asc" },
    columns: ["name", "hp"],
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "hp", label: "HP", type: "number", required: true },
    ],
  },
  {
    key: "products",
    label: "Products",
    group: "Catalogue",
    blurb: "Submersible, monoblock and solar pumps sold and serviced by Oswal.",
    model: "product",
    orderBy: { name: "asc" },
    columns: ["sku", "name", "family", "brandId", "hpCapacityId"],
    fields: [
      { key: "sku", label: "SKU", type: "text", required: true, normalize: "upper" },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "family", label: "Family", type: "select", required: true, options: familyOptions },
      { key: "categoryId", label: "Category", type: "relation", relation: { name: "category", model: "category", label: "name" } },
      { key: "brandId", label: "Brand", type: "relation", relation: { name: "brand", model: "brand", label: "name" } },
      { key: "hsnId", label: "HSN", type: "relation", relation: { name: "hsn", model: "hsnCode", label: "code" } },
      { key: "hpCapacityId", label: "HP / Capacity", type: "relation", relation: { name: "hpCapacity", model: "hpCapacity", label: "name" } },
      { key: "pumpHeadId", label: "Pump head", type: "relation", relation: { name: "pumpHead", model: "pumpHead", label: "name" } },
      { key: "warrantyMonths", label: "Warranty months", type: "number" },
      { key: "active", label: "Active", type: "boolean" },
    ],
  },
  {
    key: "customers",
    label: "Customer",
    group: "Network",
    blurb: "Farmers and owners. Booking can also create a customer from a phone number.",
    model: "customer",
    orderBy: { name: "asc" },
    columns: ["name", "phone", "districtId", "stateId", "pincode"],
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "phone", label: "Mobile", type: "text", required: true, normalize: "phone" },
      { key: "altPhone", label: "Alternate mobile", type: "text", normalize: "phone" },
      { key: "email", label: "Email", type: "text" },
      { key: "village", label: "Village", type: "text" },
      { key: "address", label: "Address", type: "textarea", fullWidth: true },
      { key: "stateId", label: "State", type: "relation", relation: { name: "state", model: "state", label: "name" } },
      { key: "districtId", label: "District", type: "relation", relation: { name: "district", model: "district", label: "name", parentKey: "stateId" } },
      { key: "areaId", label: "Area", type: "relation", relation: { name: "area", model: "area", label: "name", parentKey: "districtId" } },
      { key: "pincode", label: "Pincode", type: "text", normalize: "digits" },
    ],
  },
  {
    key: "service-centers",
    label: "Engineer / Service Center",
    group: "Network",
    blurb: "Service centres and the engineer who attends calls in that area.",
    model: "serviceCenter",
    orderBy: { name: "asc" },
    columns: ["code", "name", "engineerName", "districtId", "active"],
    fields: [
      { key: "code", label: "Code", type: "text", required: true, normalize: "upper" },
      { key: "name", label: "Centre name", type: "text", required: true },
      { key: "engineerName", label: "Engineer", type: "text", required: true },
      { key: "phone", label: "Mobile", type: "text", normalize: "phone" },
      { key: "email", label: "Email", type: "text" },
      { key: "userId", label: "Login", type: "relation", relation: { name: "user", model: "user", label: "name" } },
      { key: "stateId", label: "State", type: "relation", relation: { name: "state", model: "state", label: "name" } },
      { key: "districtId", label: "District", type: "relation", relation: { name: "district", model: "district", label: "name", parentKey: "stateId" } },
      { key: "isDefault", label: "Default for district", type: "boolean" },
      { key: "active", label: "Active", type: "boolean" },
    ],
  },
  {
    key: "beneficiaries",
    label: "Upload Beneficiary Data",
    group: "Network",
    blurb: "Scheme beneficiaries for MSEDCL and KUSUM. Use import for bulk lists.",
    model: "beneficiary",
    orderBy: { name: "asc" },
    columns: ["name", "phone", "scheme", "consumerNumber", "districtId"],
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "phone", label: "Mobile", type: "text", normalize: "phone" },
      { key: "consumerNumber", label: "Consumer number", type: "text" },
      { key: "scheme", label: "Scheme", type: "select", required: true, options: schemeOptions },
      { key: "stateId", label: "State", type: "relation", relation: { name: "state", model: "state", label: "name" } },
      { key: "districtId", label: "District", type: "relation", relation: { name: "district", model: "district", label: "name", parentKey: "stateId" } },
      { key: "village", label: "Village", type: "text" },
      { key: "pumpSerial", label: "Pump serial", type: "text" },
      { key: "capacity", label: "Capacity", type: "text" },
    ],
  },
  {
    key: "expense-types",
    label: "Expense Types",
    group: "Complaint setup",
    blurb: "Kept ready for Phase 2 expense claims.",
    model: "expenseType",
    orderBy: { name: "asc" },
    columns: ["name", "code", "active"],
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "code", label: "Code", type: "text", required: true, normalize: "upper" },
      { key: "active", label: "Active", type: "boolean" },
    ],
  },
  {
    key: "issues",
    label: "Complaint Issue",
    group: "Complaint setup",
    blurb: "Nature of the call, used on nature-wise reports.",
    model: "complaintIssue",
    orderBy: { name: "asc" },
    columns: ["name", "complaintType", "active"],
    fields: [
      { key: "name", label: "Issue", type: "text", required: true },
      { key: "complaintType", label: "Complaint type", type: "select", options: typeOptions },
      { key: "active", label: "Active", type: "boolean" },
    ],
  },
  {
    key: "sources",
    label: "Complaint Source",
    group: "Complaint setup",
    blurb: "Where the complaint was logged: call, WhatsApp, web, dealer or QR.",
    model: "complaintSource",
    orderBy: { name: "asc" },
    columns: ["name", "code", "active"],
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "code", label: "Code", type: "text", required: true, normalize: "upper" },
      { key: "active", label: "Active", type: "boolean" },
    ],
  },
  {
    key: "hold-statuses",
    label: "Complaint Hold Status",
    group: "Complaint setup",
    blurb: "Reasons a complaint sits in Pending.",
    model: "holdStatus",
    orderBy: { name: "asc" },
    columns: ["name", "code", "active"],
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "code", label: "Code", type: "text", required: true, normalize: "upper" },
      { key: "active", label: "Active", type: "boolean" },
    ],
  },
  {
    key: "checklist",
    label: "Check List",
    group: "Complaint setup",
    blurb: "Steps ticked when a complaint is closed.",
    model: "checkListItem",
    orderBy: { sortOrder: "asc" },
    columns: ["name", "complaintType", "sortOrder", "active"],
    fields: [
      { key: "name", label: "Step", type: "text", required: true },
      { key: "complaintType", label: "Complaint type", type: "select", options: typeOptions },
      { key: "sortOrder", label: "Sort", type: "number" },
      { key: "active", label: "Active", type: "boolean" },
    ],
  },
  {
    key: "problems",
    label: "Actual Problem",
    group: "Complaint setup",
    blurb: "What the engineer found. Used on problem-wise reports.",
    model: "actualProblem",
    orderBy: { name: "asc" },
    columns: ["name", "active"],
    fields: [
      { key: "name", label: "Problem", type: "text", required: true },
      { key: "active", label: "Active", type: "boolean" },
    ],
  },
  {
    key: "solutions",
    label: "Actual Solution",
    group: "Complaint setup",
    blurb: "What was done to close the complaint.",
    model: "actualSolution",
    orderBy: { name: "asc" },
    columns: ["name", "problemId", "active"],
    fields: [
      { key: "name", label: "Solution", type: "text", required: true },
      { key: "problemId", label: "Problem", type: "relation", relation: { name: "problem", model: "actualProblem", label: "name" } },
      { key: "active", label: "Active", type: "boolean" },
    ],
  },
];

export function getMaster(key: string) {
  const master = MASTERS.find((item) => item.key === key);
  if (!master) throw new AppError("Unknown master.", 404);
  return master;
}

export function toDTO(master: MasterDef): MasterDefDTO {
  const fields: MasterFieldDTO[] = master.fields.map((field) => ({
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    options: field.options,
    relation: field.relation,
    fullWidth: field.fullWidth,
  }));
  return {
    key: master.key,
    label: master.label,
    group: master.group,
    blurb: master.blurb,
    fields,
    columns: master.columns,
  };
}

export const OPTION_MODELS = [
  "state",
  "district",
  "area",
  "brand",
  "category",
  "hsnCode",
  "hpCapacity",
  "pumpHead",
  "product",
  "serviceCenter",
  "user",
  "actualProblem",
  "complaintIssue",
  "holdStatus",
] as const;
