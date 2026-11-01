const ALIASES: Record<string, string> = {
  "sr.no": "ignore",
  "sr no": "ignore",
  "s.no": "ignore",
  "comp. no": "ticketNo",
  "comp no": "ticketNo",
  "complaint no": "ticketNo",
  "complaint number": "ticketNo",
  "book date": "bookDate",
  "customer details": "customerName",
  "customer name": "customerName",
  name: "customerName",
  address: "address",
  "mobile no.": "phone",
  "mobile no": "phone",
  mobile: "phone",
  phone: "phone",
  "area/block": "areaName",
  area: "areaName",
  block: "areaName",
  district: "districtName",
  city: "districtName",
  state: "stateName",
  pincode: "pincode",
  "pin code": "pincode",
  "call type": "callType",
  category: "categoryName",
  "product details": "productDetails",
  product: "productDetails",
  "nature of complaint": "natureText",
  nature: "natureText",
  "schedule date": "scheduleDate",
  "assigned to": "assignedName",
  status: "status",
  "saral id": "saralId",
  "oem/brand name": "brandName",
  "oem/brand": "brandName",
  brand: "brandName",
  ageing: "ageing",
  aging: "ageing",
  finalstatus: "finalStatus",
  "final status": "finalStatus",
  callby: "callBy",
  "call by": "callBy",
  priority: "priority",
  "msedcl consumer no": "msedclConsumerNo",
  "consumer no": "msedclConsumerNo",
  scheme: "schemeName",
  "msedcl subdivision": "msedclSubdivision",
  subdivision: "msedclSubdivision",
  "serial no": "serialNo",
  "serial number": "serialNo",
  serial: "serialNo",
  capacity: "capacityLabel",
  "hp capacity": "capacityLabel",
  company: "companyCode",
  email: "email",
  sku: "sku",
  type: "type",
  hp: "hp",
  head: "head",
  role: "role",
  password: "password",
};

export function normaliseHeader(header: string) {
  return header.trim().toLowerCase().replace(/\s+/g, " ");
}

export function suggestMapping(headers: string[]) {
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const key = normaliseHeader(header);
    mapping[header] = ALIASES[key] ?? "";
  }
  return mapping;
}

export const COMPLAINT_FIELDS = [
  ["ticketNo", "Comp. No"],
  ["bookDate", "Book date"],
  ["customerName", "Customer"],
  ["phone", "Mobile"],
  ["address", "Address"],
  ["areaName", "Area / block"],
  ["districtName", "District"],
  ["stateName", "State"],
  ["pincode", "Pincode"],
  ["callType", "Call type"],
  ["categoryName", "Category"],
  ["productDetails", "Product details"],
  ["natureText", "Nature of complaint"],
  ["scheduleDate", "Schedule date"],
  ["assignedName", "Assigned to"],
  ["status", "Status"],
  ["saralId", "Saral Id"],
  ["brandName", "OEM / brand"],
  ["finalStatus", "Final status"],
  ["callBy", "Call by"],
  ["priority", "Priority"],
  ["msedclConsumerNo", "MSEDCL consumer no"],
  ["msedclSubdivision", "MSEDCL subdivision"],
  ["schemeName", "Scheme"],
  ["serialNo", "Serial no"],
  ["capacityLabel", "Capacity"],
  ["companyCode", "Company"],
] as const;

export const CUSTOMER_FIELDS = [
  ["customerName", "Name"],
  ["phone", "Mobile"],
  ["address", "Address"],
  ["stateName", "State"],
  ["districtName", "District"],
  ["pincode", "Pincode"],
  ["email", "Email"],
  ["companyCode", "Company"],
] as const;

export const PRODUCT_FIELDS = [
  ["sku", "SKU"],
  ["productDetails", "Name"],
  ["categoryName", "Category"],
  ["type", "Type"],
  ["hp", "HP"],
  ["head", "Head"],
  ["companyCode", "Company"],
] as const;

export const USER_FIELDS = [
  ["customerName", "Name"],
  ["email", "Email"],
  ["phone", "Mobile"],
  ["role", "Role"],
  ["password", "Password"],
  ["companyCode", "Company"],
] as const;
