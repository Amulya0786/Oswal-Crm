export const CATEGORIES = [
  "Submersible Pump",
  "Monoblock Pump",
  "Openwell Pump",
  "Jet Pump",
  "Solar Pump",
  "Controller",
  "Solar Panel",
  "Accessory",
];

export const HSN = [
  ["84137010", "Pumps for liquids"],
  ["84138190", "Other pumps"],
  ["85044090", "Static converters and controllers"],
  ["85414011", "Photovoltaic cells and panels"],
];

export const PUMP_HEADS = ["30 m", "50 m", "70 m", "80 m", "100 m", "120 m", "150 m", "200 m"];
export const CAPACITIES = ["0.5 HP", "1 HP", "1.5 HP", "2 HP", "3 HP", "5 HP", "7.5 HP"];

export type CatalogProduct = {
  sku: string;
  name: string;
  type: string;
  category: string;
  hp?: string;
  head?: string;
  hsn: string;
  company: "PUMPS" | "SOLAR";
};

export const PRODUCTS: CatalogProduct[] = [
  { sku: "OSP-050S", name: "0.5 HP Submersible", type: "SUBMERSIBLE", category: "Submersible Pump", hp: "0.5 HP", head: "50 m", hsn: "84137010", company: "PUMPS" },
  { sku: "OSP-100S", name: "1 HP Submersible", type: "SUBMERSIBLE", category: "Submersible Pump", hp: "1 HP", head: "70 m", hsn: "84137010", company: "PUMPS" },
  { sku: "OSP-150S", name: "1.5 HP Submersible", type: "SUBMERSIBLE", category: "Submersible Pump", hp: "1.5 HP", head: "80 m", hsn: "84137010", company: "PUMPS" },
  { sku: "OSP-200S", name: "2 HP Submersible", type: "SUBMERSIBLE", category: "Submersible Pump", hp: "2 HP", head: "100 m", hsn: "84137010", company: "PUMPS" },
  { sku: "OSP-300S", name: "3 HP Submersible", type: "SUBMERSIBLE", category: "Submersible Pump", hp: "3 HP", head: "120 m", hsn: "84137010", company: "PUMPS" },
  { sku: "OSP-500S", name: "5 HP Submersible", type: "SUBMERSIBLE", category: "Submersible Pump", hp: "5 HP", head: "150 m", hsn: "84137010", company: "PUMPS" },
  { sku: "OSP-050M", name: "0.5 HP Monoblock", type: "MONOBLOCK", category: "Monoblock Pump", hp: "0.5 HP", head: "30 m", hsn: "84137010", company: "PUMPS" },
  { sku: "OSP-100M", name: "1 HP Monoblock", type: "MONOBLOCK", category: "Monoblock Pump", hp: "1 HP", head: "50 m", hsn: "84137010", company: "PUMPS" },
  { sku: "OSP-200M", name: "2 HP Monoblock", type: "MONOBLOCK", category: "Monoblock Pump", hp: "2 HP", head: "70 m", hsn: "84137010", company: "PUMPS" },
  { sku: "OSP-300O", name: "3 HP Openwell", type: "OPENWELL", category: "Openwell Pump", hp: "3 HP", head: "30 m", hsn: "84138190", company: "PUMPS" },
  { sku: "OSP-100J", name: "1 HP Jet Pump", type: "JET", category: "Jet Pump", hp: "1 HP", head: "50 m", hsn: "84138190", company: "PUMPS" },
  { sku: "OSP-150J", name: "1.5 HP Jet Pump", type: "JET", category: "Jet Pump", hp: "1.5 HP", head: "70 m", hsn: "84138190", company: "PUMPS" },
  { sku: "OSS-SP3", name: "3 HP Solar Pump", type: "SOLAR", category: "Solar Pump", hp: "3 HP", head: "80 m", hsn: "84137010", company: "SOLAR" },
  { sku: "OSS-SP5", name: "5 HP Solar Pump", type: "SOLAR", category: "Solar Pump", hp: "5 HP", head: "100 m", hsn: "84137010", company: "SOLAR" },
  { sku: "OSS-SP75", name: "7.5 HP Solar Pump", type: "SOLAR", category: "Solar Pump", hp: "7.5 HP", head: "150 m", hsn: "84137010", company: "SOLAR" },
  { sku: "OSS-CTL3", name: "3 HP Solar Controller", type: "CONTROLLER", category: "Controller", hp: "3 HP", hsn: "85044090", company: "SOLAR" },
  { sku: "OSS-CTL5", name: "5 HP Solar Controller", type: "CONTROLLER", category: "Controller", hp: "5 HP", hsn: "85044090", company: "SOLAR" },
  { sku: "OSS-P335", name: "335W Solar Panel", type: "PANEL", category: "Solar Panel", hsn: "85414011", company: "SOLAR" },
  { sku: "OSS-P540", name: "540W Solar Panel", type: "PANEL", category: "Solar Panel", hsn: "85414011", company: "SOLAR" },
  { sku: "OSS-K5", name: "KUSUM 5 HP Surface Pump", type: "SOLAR", category: "Solar Pump", hp: "5 HP", head: "50 m", hsn: "84137010", company: "SOLAR" },
  { sku: "OSS-K75", name: "KUSUM 7.5 HP Submersible", type: "SOLAR", category: "Solar Pump", hp: "7.5 HP", head: "200 m", hsn: "84137010", company: "SOLAR" },
];

export const NATURES = [
  "Not pumping water",
  "Low discharge",
  "Motor burnt",
  "Pump jammed",
  "Frequent tripping",
  "Cable fault",
  "Dry run",
  "Bearing noise",
  "Starter problem",
  "Water leakage",
  "Installation pending",
  "Site not ready",
  "Panel output low",
  "Controller error",
  "App login issue",
  "Insurance inspection",
  "Scheme document pending",
  "No power at site",
  "Discharge pipe broken",
  "Capacitor failed",
];

export const PROBLEMS = [
  "Motor burnt",
  "Pump jammed",
  "Cable puncture",
  "Low voltage",
  "Dry running",
  "Panel mismatch",
  "Controller failure",
  "Installation incomplete",
  "Customer plumbing",
  "Bearing seized",
];

export const SOLUTIONS = [
  "Motor rewound",
  "Pump replaced",
  "Cable joint redone",
  "Stabilizer advised",
  "Lowered pump",
  "Panel realigned",
  "Controller replaced",
  "Installation completed",
  "Advised plumber",
  "Bearing replaced",
];

export const HOLDS = [
  "Customer not available",
  "Spare part pending",
  "Site not ready",
  "Water source dry",
  "Weather hold",
  "Dealer action pending",
  "Approval pending",
  "Customer refused visit",
];

export const CHECKLIST = [
  "Site verified",
  "Supply voltage checked",
  "Cable and joints checked",
  "Pump set at depth",
  "Discharge measured",
  "Controller programmed",
  "Panel mounting checked",
  "Customer informed",
  "Job card signed",
];

export const EXPENSE_TYPES = ["Travel", "Local conveyance", "Lodging", "Spare parts", "Toll", "Other"];

export const SOURCES = [
  ["CALL", "Call"],
  ["WHATSAPP", "WhatsApp"],
  ["WEB", "Web form"],
  ["DEALER", "Dealer"],
  ["QR", "QR link"],
] as const;

export const FIRST_NAMES = ["Ramesh", "Suresh", "Amit", "Priya", "Neha", "Vikas", "Pooja", "Imran", "Harpreet", "Anil", "Kavita", "Rahul", "Sunita", "Manoj", "Deepak", "Asha", "Ganesh", "Meena", "Yogesh", "Kiran"];
export const LAST_NAMES = ["Kumar", "Singh", "Sharma", "Devi", "Yadav", "Patil", "Kaur", "Khan", "Gupta", "Verma", "Jadhav", "More", "Tiwari", "Pal", "Das", "Reddy", "Nair", "Joshi", "Malik", "Chauhan"];
