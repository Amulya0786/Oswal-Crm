import "dotenv/config";
import { randomBytes, randomUUID } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { buildSampleWorkbook } from "../src/lib/import/sample";
import { DEFAULT_SLA, isCloseBreach, isResponseBreach, slaDueDates } from "../src/lib/sla";
import { startOfDayIST, zonedParts } from "../src/lib/time";

const STATES: [string, string][] = [
  ["AN", "Andaman and Nicobar Islands"], ["AP", "Andhra Pradesh"], ["AR", "Arunachal Pradesh"], ["AS", "Assam"],
  ["BR", "Bihar"], ["CH", "Chandigarh"], ["CT", "Chhattisgarh"], ["DN", "Dadra and Nagar Haveli and Daman and Diu"],
  ["DL", "Delhi"], ["GA", "Goa"], ["GJ", "Gujarat"], ["HR", "Haryana"], ["HP", "Himachal Pradesh"],
  ["JK", "Jammu and Kashmir"], ["JH", "Jharkhand"], ["KA", "Karnataka"], ["KL", "Kerala"], ["LA", "Ladakh"],
  ["LD", "Lakshadweep"], ["MP", "Madhya Pradesh"], ["MH", "Maharashtra"], ["MN", "Manipur"], ["ML", "Meghalaya"],
  ["MZ", "Mizoram"], ["NL", "Nagaland"], ["OR", "Odisha"], ["PY", "Puducherry"], ["PB", "Punjab"], ["RJ", "Rajasthan"],
  ["SK", "Sikkim"], ["TN", "Tamil Nadu"], ["TG", "Telangana"], ["TR", "Tripura"], ["UP", "Uttar Pradesh"],
  ["UK", "Uttarakhand"], ["WB", "West Bengal"],
];

const DISTRICTS: Record<string, [string, string][]> = {
  HR: [
    ["Ambala", "134003"], ["Panchkula", "134109"], ["Yamunanagar", "135001"], ["Kurukshetra", "136118"],
    ["Kaithal", "136027"], ["Karnal", "132001"], ["Panipat", "132103"], ["Sonipat", "131001"],
    ["Jind", "126102"], ["Fatehabad", "125050"], ["Sirsa", "125055"], ["Hisar", "125001"],
    ["Bhiwani", "127021"], ["Charkhi Dadri", "127306"], ["Rohtak", "124001"], ["Jhajjar", "124103"],
    ["Mahendragarh", "123029"], ["Rewari", "123401"], ["Gurugram", "122001"], ["Nuh", "122107"],
    ["Faridabad", "121001"], ["Palwal", "121102"],
  ],
  UP: [
    ["Lucknow", "226001"], ["Kanpur Nagar", "208001"], ["Varanasi", "221001"], ["Prayagraj", "211001"],
    ["Agra", "282001"], ["Meerut", "250001"], ["Ghaziabad", "201001"], ["Gautam Buddha Nagar", "201301"],
    ["Gorakhpur", "273001"], ["Bareilly", "243001"], ["Moradabad", "244001"], ["Aligarh", "202001"],
    ["Mathura", "281001"], ["Jhansi", "284001"], ["Saharanpur", "247001"], ["Muzaffarnagar", "251001"],
    ["Ayodhya", "224123"],
  ],
  MH: [
    ["Mumbai", "400001"], ["Pune", "411001"], ["Nagpur", "440001"], ["Nashik", "422001"], ["Thane", "400601"],
    ["Chhatrapati Sambhajinagar", "431001"], ["Kolhapur", "416001"], ["Solapur", "413001"], ["Ahmednagar", "414001"],
    ["Satara", "415001"], ["Raigad", "402109"], ["Jalgaon", "425001"], ["Amravati", "444601"], ["Sangli", "416416"],
  ],
};

const FIRST = ["Baldev", "Harpreet", "Sunita", "Ramesh", "Meena", "Imran", "Kavita", "Suresh", "Anita", "Prakash", "Gurmeet", "Lata", "Nitin", "Pooja", "Arun", "Seema", "Yogesh", "Farida", "Manoj", "Rekha"];
const LAST = ["Singh", "Kaur", "Sharma", "Verma", "Patil", "Yadav", "Khan", "Gupta", "Joshi", "Deshmukh", "Bishnoi", "Tiwari", "Malik", "Kulkarni", "Chauhan"];
const VILLAGES = ["Rampura", "Model Town", "Civil Lines", "Grain Market", "Canal Road", "Shiv Colony", "Indira Nagar", "Sadar Bazar"];
const NARRATIONS = [
  "Pump runs but the tank fills slowly since last week.",
  "Motor hums and does not pick up. Farmer switched it off.",
  "New borewell is ready and the starter is on site.",
  "Panel shows a dry-run trip every afternoon.",
  "Cable joint near the borewell is warm.",
  "Insurance survey is pending after the motor burnt.",
  "Customer cannot see the complaint in the mobile app.",
  "Scheme file has a name mismatch with the beneficiary list.",
  "Low voltage in the village. Pump trips on start.",
  "Installation team needs the final pit depth.",
];

function mulberry32(seed: number) {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, list: T[]): T {
  return list[Math.floor(rng() * list.length)];
}

async function chunks<T>(items: T[], size: number, write: (part: T[]) => Promise<unknown>) {
  for (let index = 0; index < items.length; index += size) await write(items.slice(index, index + size));
}

async function wipe(prisma: PrismaClient) {
  await prisma.notificationLog.deleteMany();
  await prisma.escalationLog.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.complaintEvent.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.installedAsset.deleteMany();
  await prisma.beneficiary.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.pincode.deleteMany();
  await prisma.serviceCenter.deleteMany();
  await prisma.area.deleteMany();
  await prisma.userDistrictAccess.deleteMany();
  await prisma.userStateAccess.deleteMany();
  await prisma.userBrandAccess.deleteMany();
  await prisma.district.deleteMany();
  await prisma.user.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.hsnCode.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.hpCapacity.deleteMany();
  await prisma.pumpHead.deleteMany();
  await prisma.actualSolution.deleteMany();
  await prisma.actualProblem.deleteMany();
  await prisma.complaintIssue.deleteMany();
  await prisma.complaintSource.deleteMany();
  await prisma.holdStatus.deleteMany();
  await prisma.checkListItem.deleteMany();
  await prisma.expenseType.deleteMany();
  await prisma.slaPolicy.deleteMany();
  await prisma.notificationTemplate.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.state.deleteMany();
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing. Copy .env.example to .env.");
  const prisma = new PrismaClient();
  const rng = mulberry32(20261101);
  const now = new Date();
  const clock = zonedParts(now);
  await wipe(prisma);

  const stateRecords = await Promise.all(STATES.map(([code, name]) => prisma.state.create({ data: { code, name } })));
  const stateByCode = new Map(stateRecords.map((state) => [state.code, state]));

  const districtRows: { id: string; name: string; stateId: string; stateCode: string; pin: string; areaId: string }[] = [];
  for (const [code, list] of Object.entries(DISTRICTS)) {
    const state = stateByCode.get(code);
    if (!state) continue;
    for (const [name, pin] of list) {
      const district = await prisma.district.create({ data: { name, stateId: state.id } });
      const area = await prisma.area.create({ data: { name: `${name} HQ`, districtId: district.id } });
      districtRows.push({ id: district.id, name, stateId: state.id, stateCode: code, pin, areaId: area.id });
    }
  }
  const districtByName = new Map(districtRows.map((district) => [district.name, district]));

  const passwords = {
    admin: bcrypt.hashSync("Admin@123", 10),
    call: bcrypt.hashSync("Call@123", 10),
    area: bcrypt.hashSync("Area@123", 10),
    state: bcrypt.hashSync("State@123", 10),
    tech: bcrypt.hashSync("Tech@123", 10),
    dealer: bcrypt.hashSync("Dealer@123", 10),
  };

  const brands = await Promise.all([
    prisma.brand.create({ data: { name: "Oswal", code: "OSW" } }),
    prisma.brand.create({ data: { name: "Oswal Solar", code: "OSL" } }),
    prisma.brand.create({ data: { name: "Oswal Industrial", code: "OSI" } }),
  ]);
  const brandByCode = new Map(brands.map((brand) => [brand.code, brand]));

  const userSeeds: { name: string; email: string; code: string; role: string; phone: string; hash: string; states: string[]; districts: string[]; brands: string[]; district?: string }[] = [
    { name: "Asha Malik", email: "admin@oswalpumps.local", code: "OPL-ADM-001", role: "ADMIN", phone: "9811100001", hash: passwords.admin, states: [], districts: [], brands: [] },
    { name: "Rohit Verma", email: "callcentre@oswalpumps.local", code: "OPL-CC-014", role: "CALL_CENTRE", phone: "9811100002", hash: passwords.call, states: STATES.map(([code]) => code), districts: [], brands: ["OSW", "OSL", "OSI"] },
    { name: "Neha Gupta", email: "callcentre2@oswalpumps.local", code: "OPL-CC-015", role: "CALL_CENTRE", phone: "9811100003", hash: passwords.call, states: ["HR", "UP", "MH"], districts: [], brands: ["OSW", "OSL", "OSI"] },
    { name: "Suresh Kaushik", email: "sh.haryana@oswalpumps.local", code: "OPL-SH-HR", role: "STATE_HEAD", phone: "9811100011", hash: passwords.state, states: ["HR"], districts: [], brands: ["OSW", "OSL", "OSI"] },
    { name: "Imran Siddiqui", email: "sh.up@oswalpumps.local", code: "OPL-SH-UP", role: "STATE_HEAD", phone: "9811100012", hash: passwords.state, states: ["UP"], districts: [], brands: ["OSW", "OSL", "OSI"] },
    { name: "Sneha Patil", email: "sh.maharashtra@oswalpumps.local", code: "OPL-SH-MH", role: "STATE_HEAD", phone: "9811100013", hash: passwords.state, states: ["MH"], districts: [], brands: ["OSW", "OSL", "OSI"] },
    { name: "Vikram Singh", email: "am.karnal@oswalpumps.local", code: "OPL-AM-KNL", role: "AREA_MANAGER", phone: "9811100021", hash: passwords.area, states: ["HR"], districts: ["Karnal", "Panipat", "Kurukshetra", "Kaithal", "Yamunanagar"], brands: ["OSW", "OSL", "OSI"] },
    { name: "Manoj Bishnoi", email: "am.hisar@oswalpumps.local", code: "OPL-AM-HSR", role: "AREA_MANAGER", phone: "9811100022", hash: passwords.area, states: ["HR"], districts: ["Hisar", "Sirsa", "Fatehabad", "Jind", "Bhiwani"], brands: ["OSW", "OSL", "OSI"] },
    { name: "Anil Tiwari", email: "am.lucknow@oswalpumps.local", code: "OPL-AM-LKO", role: "AREA_MANAGER", phone: "9811100023", hash: passwords.area, states: ["UP"], districts: ["Lucknow", "Kanpur Nagar", "Ayodhya", "Gorakhpur", "Prayagraj", "Varanasi"], brands: ["OSW", "OSL", "OSI"] },
    { name: "Farhan Ali", email: "am.meerut@oswalpumps.local", code: "OPL-AM-MRT", role: "AREA_MANAGER", phone: "9811100024", hash: passwords.area, states: ["UP"], districts: ["Meerut", "Ghaziabad", "Gautam Buddha Nagar", "Muzaffarnagar", "Saharanpur", "Bareilly", "Moradabad"], brands: ["OSW", "OSL", "OSI"] },
    { name: "Kavita Joshi", email: "am.pune@oswalpumps.local", code: "OPL-AM-PUN", role: "AREA_MANAGER", phone: "9811100025", hash: passwords.area, states: ["MH"], districts: ["Pune", "Satara", "Kolhapur", "Solapur", "Sangli", "Raigad"], brands: ["OSW", "OSL", "OSI"] },
    { name: "Rahul Deshmukh", email: "am.nagpur@oswalpumps.local", code: "OPL-AM-NGP", role: "AREA_MANAGER", phone: "9811100026", hash: passwords.area, states: ["MH"], districts: ["Nagpur", "Amravati", "Nashik", "Jalgaon", "Ahmednagar", "Chhatrapati Sambhajinagar"], brands: ["OSW", "OSL", "OSI"] },
    { name: "Harpreet Singh", email: "dealer.karnal@oswalpumps.local", code: "OPL-DLR-KNL", role: "DEALER", phone: "9811100031", hash: passwords.dealer, states: ["HR"], districts: ["Karnal"], brands: ["OSW"] },
    { name: "Amit Kulkarni", email: "dealer.pune@oswalpumps.local", code: "OPL-DLR-PUN", role: "DEALER", phone: "9811100032", hash: passwords.dealer, states: ["MH"], districts: ["Pune"], brands: ["OSL"] },
  ];
  const techNames: [string, string, string][] = [
    ["Raju Singh", "tech.karnal@oswalpumps.local", "Karnal"],
    ["Sanjay Kumar", "tech.panipat@oswalpumps.local", "Panipat"],
    ["Baljit Singh", "tech.hisar@oswalpumps.local", "Hisar"],
    ["Pardeep Sharma", "tech.rohtak@oswalpumps.local", "Rohtak"],
    ["Aman Yadav", "tech.gurugram@oswalpumps.local", "Gurugram"],
    ["Dinesh Tiwari", "tech.lucknow@oswalpumps.local", "Lucknow"],
    ["Rakesh Pal", "tech.kanpur@oswalpumps.local", "Kanpur Nagar"],
    ["Ajay Maurya", "tech.varanasi@oswalpumps.local", "Varanasi"],
    ["Naveen Malik", "tech.meerut@oswalpumps.local", "Meerut"],
    ["Salman Qureshi", "tech.ghaziabad@oswalpumps.local", "Ghaziabad"],
    ["Sagar Pawar", "tech.pune@oswalpumps.local", "Pune"],
    ["Kishor Raut", "tech.nagpur@oswalpumps.local", "Nagpur"],
  ];
  techNames.forEach(([name, email, district], index) => {
    const stateCode = districtRows.find((row) => row.name === district)?.stateCode ?? "HR";
    userSeeds.push({ name, email, code: `OPL-TECH-${String(index + 1).padStart(2, "0")}`, role: "TECHNICIAN", phone: `9811101${String(index).padStart(3, "0")}`, hash: passwords.tech, states: [stateCode], districts: [district], brands: ["OSW", "OSL"], district });
  });

  const users = [];
  for (const seed of userSeeds) {
    const user = await prisma.user.create({
      data: { name: seed.name, email: seed.email, employeeCode: seed.code, role: seed.role, phone: seed.phone, passwordHash: seed.hash },
    });
    users.push({ ...user, seed });
    if (seed.states.length) {
      await prisma.userStateAccess.createMany({ data: seed.states.map((code) => ({ userId: user.id, stateId: stateByCode.get(code)!.id })) });
    }
    if (seed.districts.length) {
      await prisma.userDistrictAccess.createMany({ data: seed.districts.map((name) => ({ userId: user.id, districtId: districtByName.get(name)!.id })) });
    }
    if (seed.brands.length) {
      await prisma.userBrandAccess.createMany({ data: seed.brands.map((code) => ({ userId: user.id, brandId: brandByCode.get(code)!.id })) });
    }
  }
  const userByEmail = new Map(users.map((user) => [user.email, user]));
  const admin = userByEmail.get("admin@oswalpumps.local")!;
  const callCentre = userByEmail.get("callcentre@oswalpumps.local")!;
  const managers = users.filter((user) => user.role === "AREA_MANAGER");
  const stateHeads = users.filter((user) => user.role === "STATE_HEAD");

  const centers = [];
  for (const district of districtRows) {
    const tech = users.find((user) => user.seed.district === district.name);
    const center = await prisma.serviceCenter.create({
      data: {
        code: `SC-${district.stateCode}-${district.pin}`,
        name: `${district.name} Service Centre`,
        engineerName: tech?.name ?? `${district.name.split(" ")[0]} Engineer`,
        phone: tech?.phone ?? "9811190000",
        userId: tech?.id,
        stateId: district.stateId,
        districtId: district.id,
        isDefault: true,
        active: true,
      },
    });
    centers.push(center);
    await prisma.pincode.create({
      data: { code: district.pin, stateId: district.stateId, districtId: district.id, areaId: district.areaId, serviceCenterId: center.id },
    });
  }
  const karnal = districtByName.get("Karnal")!;
  const karnalCenter = centers.find((center) => center.districtId === karnal.id)!;
  for (const [name, pin] of [["Nilokheri", "132117"], ["Assandh", "132039"], ["Gharaunda", "132114"], ["Indri", "132041"]] as const) {
    const area = await prisma.area.create({ data: { name, districtId: karnal.id } });
    await prisma.pincode.create({ data: { code: pin, stateId: karnal.stateId, districtId: karnal.id, areaId: area.id, serviceCenterId: karnalCenter.id } });
  }
  const centerByDistrict = new Map(centers.map((center) => [center.districtId, center]));

  const categories = await Promise.all(["Submersible", "Monoblock", "Openwell", "Solar Surface", "Solar Submersible"].map((name) => prisma.category.create({ data: { name } })));
  const categoryByName = new Map(categories.map((category) => [category.name, category]));
  const hsn = await Promise.all([
    prisma.hsnCode.create({ data: { code: "84137010", description: "Centrifugal pumps", gstRate: 18 } }),
    prisma.hsnCode.create({ data: { code: "84138190", description: "Other pumps for liquids", gstRate: 18 } }),
    prisma.hsnCode.create({ data: { code: "85015210", description: "AC motors, multi-phase", gstRate: 18 } }),
    prisma.hsnCode.create({ data: { code: "85414300", description: "Photovoltaic cells assembled in modules", gstRate: 12 } }),
  ]);
  const hpRows = await Promise.all([0.5, 1, 1.5, 2, 3, 5, 7.5].map((hp) => prisma.hpCapacity.create({ data: { name: `${hp} HP`, hp } })));
  const hpByName = new Map(hpRows.map((row) => [row.name, row]));
  const headRows = await Promise.all([20, 30, 45, 60, 90, 120, 150].map((metres) => prisma.pumpHead.create({ data: { name: `${metres} m`, metres } })));
  const headByName = new Map(headRows.map((row) => [row.name, row]));
  const catalogue: [string, string, string, string, string, string, string][] = [
    ["OSP-V4-100", "Oswal V4 Submersible 1 HP", "Submersible", "OSW", "Submersible", "1 HP", "45 m"],
    ["OSP-V4-150", "Oswal V4 Submersible 1.5 HP", "Submersible", "OSW", "Submersible", "1.5 HP", "60 m"],
    ["OSP-V4-200", "Oswal V4 Submersible 2 HP", "Submersible", "OSW", "Submersible", "2 HP", "90 m"],
    ["OSP-V6-300", "Oswal V6 Submersible 3 HP", "Submersible", "OSW", "Submersible", "3 HP", "120 m"],
    ["OSP-V6-500", "Oswal V6 Submersible 5 HP", "Submersible", "OSW", "Submersible", "5 HP", "150 m"],
    ["OSP-OW-100", "Oswal Openwell 1 HP", "Openwell", "OSW", "Openwell", "1 HP", "30 m"],
    ["OSP-OW-200", "Oswal Openwell 2 HP", "Openwell", "OSW", "Openwell", "2 HP", "45 m"],
    ["OMB-050", "Oswal Monoblock 0.5 HP", "Monoblock", "OSW", "Monoblock", "0.5 HP", "20 m"],
    ["OMB-100", "Oswal Monoblock 1 HP", "Monoblock", "OSW", "Monoblock", "1 HP", "30 m"],
    ["OMB-150", "Oswal Monoblock 1.5 HP", "Monoblock", "OSW", "Monoblock", "1.5 HP", "45 m"],
    ["OMB-200", "Oswal Monoblock 2 HP", "Monoblock", "OSI", "Monoblock", "2 HP", "45 m"],
    ["OSL-SUR-100", "Oswal Solar Surface 1 HP", "Solar Surface", "OSL", "Solar Surface", "1 HP", "30 m"],
    ["OSL-SUR-300", "Oswal Solar Surface 3 HP", "Solar Surface", "OSL", "Solar Surface", "3 HP", "60 m"],
    ["OSL-SUB-100", "Oswal Solar Submersible 1 HP", "Solar Submersible", "OSL", "Solar Submersible", "1 HP", "45 m"],
    ["OSL-SUB-200", "Oswal Solar Submersible 2 HP", "Solar Submersible", "OSL", "Solar Submersible", "2 HP", "60 m"],
    ["OSL-SUB-300", "Oswal Solar Submersible 3 HP", "Solar Submersible", "OSL", "Solar Submersible", "3 HP", "90 m"],
    ["OSL-SUB-500", "Oswal Solar Submersible 5 HP", "Solar Submersible", "OSL", "Solar Submersible", "5 HP", "120 m"],
  ];
  const products = [];
  for (const [sku, name, family, brand, category, hp, head] of catalogue) {
    products.push(await prisma.product.create({
      data: {
        sku, name, family,
        brandId: brandByCode.get(brand)!.id,
        categoryId: categoryByName.get(category)!.id,
        hsnId: family.startsWith("Solar") ? hsn[3].id : hsn[0].id,
        hpCapacityId: hpByName.get(hp)!.id,
        pumpHeadId: headByName.get(head)!.id,
        warrantyMonths: family.startsWith("Solar") ? 24 : 18,
      },
    }));
  }

  const issueSeeds: [string, string][] = [
    ["Motor not starting", "BREAKDOWN"], ["Low water discharge", "BREAKDOWN"], ["Pump tripping", "BREAKDOWN"],
    ["Cable damage", "BREAKDOWN"], ["Dry run", "BREAKDOWN"], ["Seal leakage", "BREAKDOWN"], ["Noise or vibration", "BREAKDOWN"],
    ["Installation schedule", "INSTALLATION"], ["Site not ready", "INSTALLATION"],
    ["Insurance inspection", "INSURANCE"], ["Claim documents pending", "INSURANCE"],
    ["Mobile app login failure", "MOBILE_APP"], ["App not showing complaint", "MOBILE_APP"],
    ["Beneficiary mismatch", "SCHEME"], ["Scheme document pending", "SCHEME"],
  ];
  const issues = await Promise.all(issueSeeds.map(([name, complaintType]) => prisma.complaintIssue.create({ data: { name, complaintType } })));
  await prisma.complaintSource.createMany({ data: [
    { name: "Call", code: "CALL" }, { name: "WhatsApp", code: "WHATSAPP" }, { name: "Web Form", code: "WEB_FORM" },
    { name: "Dealer", code: "DEALER" }, { name: "QR Link", code: "QR" },
  ] });
  const holds = await Promise.all([
    ["Customer not available", "CNA"], ["Spare pending", "SPR"], ["Site not ready", "SITE"],
    ["Dealer pending", "DLR"], ["Weather", "WTH"], ["Documents pending", "DOC"],
  ].map(([name, code]) => prisma.holdStatus.create({ data: { name, code } })));
  const problems = await Promise.all(["Winding burnt", "Capacitor failed", "Impeller jammed", "Bearing worn", "Panel inverter fault", "Cable joint open", "Foot valve blocked", "Installation incomplete", "No fault found"].map((name) => prisma.actualProblem.create({ data: { name } })));
  const solutionNames = ["Rewound motor", "Replaced capacitor", "Cleaned impeller", "Replaced bearing", "Replaced inverter", "Rejointed cable", "Replaced foot valve", "Completed installation", "Guided the customer"];
  const solutions = [];
  for (let index = 0; index < solutionNames.length; index++) {
    solutions.push(await prisma.actualSolution.create({ data: { name: solutionNames[index], problemId: problems[index].id } }));
  }
  await prisma.checkListItem.createMany({ data: [
    { name: "Supply voltage checked", complaintType: "BREAKDOWN", sortOrder: 1 },
    { name: "Cable joint inspected", complaintType: "BREAKDOWN", sortOrder: 2 },
    { name: "Customer informed of the finding", sortOrder: 3 },
    { name: "Pit and starter position checked", complaintType: "INSTALLATION", sortOrder: 1 },
    { name: "Panel serial noted", complaintType: "SCHEME", sortOrder: 1 },
    { name: "Documents collected", complaintType: "INSURANCE", sortOrder: 1 },
  ] });
  await prisma.expenseType.createMany({ data: [
    { name: "Travel", code: "TRV" }, { name: "Lodging", code: "LDG" }, { name: "Local conveyance", code: "LOC" },
    { name: "Spare purchase", code: "SPR" }, { name: "Toll", code: "TOL" }, { name: "Other", code: "OTH" },
  ] });
  await prisma.slaPolicy.createMany({ data: Object.entries(DEFAULT_SLA).map(([complaintType, hours]) => ({ complaintType, ...hours, escalationCooldownHours: 12 })) });
  await prisma.notificationTemplate.createMany({ data: [
    { event: "BOOKING", channel: "sms", body: "Oswal Pumps: complaint {{ticketNumber}} is registered for {{customerName}}. We will contact you shortly." },
    { event: "BOOKING", channel: "whatsapp", body: "Hello {{customerName}}, your Oswal Pumps complaint {{ticketNumber}} ({{type}}) is registered." },
    { event: "BOOKING", channel: "email", subject: "Complaint {{ticketNumber}} registered", body: "Dear {{customerName}},\n\nComplaint {{ticketNumber}} is registered with Oswal Pumps Service.\nType: {{type}}\n" },
    { event: "ASSIGNMENT", channel: "sms", body: "Oswal Pumps: complaint {{ticketNumber}} is assigned to {{technicianName}} ({{centerName}})." },
    { event: "ASSIGNMENT", channel: "whatsapp", body: "Complaint {{ticketNumber}} is assigned to {{technicianName}} from {{centerName}}." },
    { event: "ASSIGNMENT", channel: "email", subject: "Engineer assigned for {{ticketNumber}}", body: "Dear {{customerName}},\n\n{{technicianName}} from {{centerName}} will attend complaint {{ticketNumber}}.\n" },
    { event: "VISIT", channel: "sms", body: "Oswal Pumps: our engineer is attending complaint {{ticketNumber}}." },
    { event: "VISIT", channel: "whatsapp", body: "Our engineer is at your site for complaint {{ticketNumber}}." },
    { event: "VISIT", channel: "email", subject: "Visit update {{ticketNumber}}", body: "A visit was logged for complaint {{ticketNumber}}." },
    { event: "CLOSING", channel: "sms", body: "Oswal Pumps: complaint {{ticketNumber}} is closed. Share feedback: {{feedbackLink}}" },
    { event: "CLOSING", channel: "whatsapp", body: "Complaint {{ticketNumber}} is closed. Please rate the service: {{feedbackLink}}" },
    { event: "CLOSING", channel: "email", subject: "Complaint {{ticketNumber}} closed", body: "Dear {{customerName}},\n\nComplaint {{ticketNumber}} is closed. Tell us how we did: {{feedbackLink}}\n" },
    { event: "ESCALATION", channel: "sms", body: "Oswal CRM: {{ticketNumber}} for {{customerName}} is escalated to you ({{toRole}})." },
    { event: "ESCALATION", channel: "email", subject: "Escalation {{ticketNumber}}", body: "{{toName}}, complaint {{ticketNumber}} for {{customerName}} is escalated to {{toRole}}." },
  ] });

  const focus = ["Karnal", "Lucknow", "Pune", "Nagpur", "Hisar", "Meerut", "Ghaziabad", "Kanpur Nagar"];
  const customers: {
    id: string;
    name: string;
    phone: string;
    address: string | null;
    districtId: string | null;
    assetId: string;
    serial: string;
    product: { id: string; name: string; brandId: string | null };
  }[] = [];
  for (let index = 0; index < 110; index++) {
    const district = index === 0 ? karnal : rng() < 0.62 ? districtByName.get(pick(rng, focus))! : pick(rng, districtRows);
    const name = index === 0 ? "Baldev Singh" : `${pick(rng, FIRST)} ${pick(rng, LAST)}`;
    const phone = String(9811000001 + index);
    const product = products[index % products.length];
    const customer = await prisma.customer.create({
      data: {
        name,
        phone,
        village: pick(rng, VILLAGES),
        address: `${pick(rng, VILLAGES)}, ${district.name}`,
        stateId: district.stateId,
        districtId: district.id,
        areaId: district.areaId,
        pincode: district.pin,
        searchText: `${name} ${phone} ${district.name}`.toLowerCase(),
      },
    });
    const asset = await prisma.installedAsset.create({
      data: { serialNumber: `OSW${String(index + 1).padStart(5, "0")}`, customerId: customer.id, productId: product.id, installedOn: new Date(now.getTime() - (40 + index) * 86_400_000) },
    });
    customers.push({ ...customer, assetId: asset.id, serial: asset.serialNumber, product });
  }

  for (let index = 0; index < 12; index++) {
    const district = pick(rng, districtRows.filter((row) => row.stateCode === "MH" || row.name === "Karnal"));
    await prisma.beneficiary.create({
      data: {
        name: `${pick(rng, FIRST)} ${pick(rng, LAST)}`,
        phone: String(9811200001 + index),
        consumerNumber: `${district.stateCode === "MH" ? "MS" : "KS"}${100200 + index}`,
        scheme: district.stateCode === "MH" ? "MSEDCL" : "KUSUM",
        stateId: district.stateId,
        districtId: district.id,
        village: pick(rng, VILLAGES),
        capacity: pick(rng, ["1 HP", "2 HP", "3 HP", "5 HP"]),
      },
    });
  }

  const today: string[] = ["ASSIGNED", "OPEN", "ASSIGNED", "PENDING", "OPEN", "ASSIGNED", "REASSIGNED", "PENDING", "CLOSED", "CLOSED", "CLOSED", "HAPPY_CALLING_DONE", "HAPPY_CALLING_DONE", "CANCELLED"];
  const rest = [
    ...Array(62).fill("OPEN"), ...Array(167).fill("ASSIGNED"), ...Array(27).fill("REASSIGNED"),
    ...Array(84).fill("PENDING"), ...Array(39).fill("CLOSED"), ...Array(22).fill("HAPPY_CALLING_DONE"), ...Array(11).fill("CANCELLED"),
  ];
  const statuses = [...today, ...rest];
  const sources = ["CALL", "WHATSAPP", "WEB_FORM", "DEALER", "QR"];
  const complaints = [];
  const events = [];
  const escalations = [];
  const dayStart = startOfDayIST(now).getTime();

  for (let index = 0; index < statuses.length; index++) {
    const status = statuses[index];
    const customer = customers[index % customers.length];
    const district = districtRows.find((row) => row.id === customer.districtId) ?? karnal;
    const center = centerByDistrict.get(district.id)!;
    const typeRoll = rng();
    const type = typeRoll < 0.55 ? "BREAKDOWN" : typeRoll < 0.7 ? "INSTALLATION" : typeRoll < 0.85 ? "INSURANCE" : typeRoll < 0.93 ? "MOBILE_APP" : "SCHEME";
    const open = ["OPEN", "ASSIGNED", "REASSIGNED", "PENDING"].includes(status);
    let ageDays = 0;
    if (index >= today.length) {
      if (!open) ageDays = 1 + Math.floor(rng() * 75);
      else if (rng() < 0.22) ageDays = Math.floor(rng() * 3);
      else if (rng() < 0.5) ageDays = 3 + Math.floor(rng() * 5);
      else if (rng() < 0.75) ageDays = 8 + Math.floor(rng() * 8);
      else ageDays = 16 + Math.floor(rng() * 55);
    }
    const hour = Math.max(0, Math.min(clock.hour, Math.floor(rng() * Math.max(clock.hour, 1))));
    let createdAt = new Date(dayStart - ageDays * 86_400_000 + hour * 3_600_000 + Math.floor(rng() * 40) * 60_000);
    if (createdAt.getTime() > now.getTime() - 60_000) createdAt = new Date(now.getTime() - 60_000);
    const policy = DEFAULT_SLA[type];
    const dues = slaDueDates(createdAt, policy.responseHours, policy.closeHours);
    const assigned = status !== "OPEN";
    const assignedAt = assigned ? new Date(Math.min(now.getTime() - 30_000, createdAt.getTime() + 3_600_000)) : null;
    const closedAt = status === "CLOSED" || status === "HAPPY_CALLING_DONE" ? new Date(Math.min(now.getTime() - 20_000, createdAt.getTime() + (ageDays === 0 ? 3_600_000 : 2 * 86_400_000))) : null;
    const happyAt = status === "HAPPY_CALLING_DONE" && closedAt ? new Date(Math.min(now.getTime() - 10_000, closedAt.getTime() + 1_800_000)) : null;
    const cancelledAt = status === "CANCELLED" ? new Date(Math.min(now.getTime() - 10_000, createdAt.getTime() + 86_400_000)) : null;
    let escalationLevel = 0;
    if (open && ageDays > 45) escalationLevel = 3;
    else if (open && ageDays > 30) escalationLevel = 2;
    else if (open && ageDays > 18) escalationLevel = 1;
    const lastEscalatedAt = escalationLevel ? new Date(now.getTime() - 2 * 3_600_000) : null;
    const target = escalationLevel === 1 ? managers.find((user) => user.seed.districts.includes(district.name)) : escalationLevel === 2 ? stateHeads.find((user) => user.seed.states.includes(district.stateCode)) : escalationLevel === 3 ? admin : null;
    const issue = issues.find((row) => row.complaintType === type) ?? issues[0];
    const problem = status === "CLOSED" || status === "HAPPY_CALLING_DONE" ? pick(rng, problems) : null;
    const solution = problem ? solutions.find((row) => row.problemId === problem.id) ?? solutions[0] : null;
    const id = randomUUID();
    const ticketSeq = 10001 + index;
    const ticketNumber = `OPL${ticketSeq}`;
    const slaShape = { status, firstResponseAt: assignedAt, slaResponseDue: dues.slaResponseDue, slaCloseDue: dues.slaCloseDue, escalationLevel, lastEscalatedAt };
    const creator = index % 4 === 0 ? admin : callCentre;
    complaints.push({
      id,
      ticketSeq,
      ticketNumber,
      status,
      type,
      source: sources[index % sources.length],
      priority: rng() < 0.08 ? "URGENT" : rng() < 0.2 ? "HIGH" : "NORMAL",
      customerId: customer.id,
      productId: customer.product.id,
      assetId: customer.assetId,
      serialNumber: customer.serial,
      brandId: customer.product.brandId,
      issueId: issue.id,
      description: pick(rng, NARRATIONS),
      stateId: district.stateId,
      districtId: district.id,
      areaId: district.areaId,
      pincode: district.pin,
      address: customer.address,
      serviceCenterId: assigned ? center.id : null,
      assignedToUserId: assigned ? center.userId : null,
      assignedAt,
      holdStatusId: status === "PENDING" ? pick(rng, holds).id : null,
      holdReason: status === "PENDING" ? "Waiting on the customer or a spare." : null,
      heldAt: status === "PENDING" ? assignedAt : null,
      actualProblemId: problem?.id ?? null,
      actualSolutionId: solution?.id ?? null,
      closeNotes: closedAt ? "Attended on site and confirmed discharge with the customer." : null,
      closedAt,
      cancelReason: status === "CANCELLED" ? "Customer withdrew the complaint." : null,
      cancelledAt,
      happyRating: happyAt ? 3 + Math.floor(rng() * 3) : null,
      happyNotes: happyAt ? "Customer confirmed the pump is running." : null,
      happyAt,
      scheme: type === "SCHEME" ? (district.stateCode === "MH" ? "MSEDCL" : "KUSUM") : null,
      consumerNumber: type === "SCHEME" ? `${district.stateCode}${200000 + index}` : null,
      feedbackToken: randomBytes(16).toString("hex"),
      escalationLevel,
      escalatedToUserId: target?.id ?? null,
      lastEscalatedAt,
      slaResponseDue: dues.slaResponseDue,
      slaCloseDue: dues.slaCloseDue,
      firstResponseAt: assignedAt,
      responseBreached: isResponseBreach(slaShape, now),
      closeBreached: isCloseBreach(slaShape, now),
      searchText: `${ticketNumber} ${customer.name} ${customer.phone} ${customer.serial} ${customer.product.name}`.toLowerCase(),
      createdById: creator.id,
      createdAt,
    });
    events.push({ id: randomUUID(), complaintId: id, type: "BOOKED", message: "Complaint booked.", userId: creator.id, createdAt });
    if (assigned && assignedAt) events.push({ id: randomUUID(), complaintId: id, type: status === "REASSIGNED" ? "REASSIGNED" : "ASSIGNED", message: `Assigned to ${center.name} (${center.engineerName}).`, userId: creator.id, createdAt: assignedAt });
    if (status === "PENDING" && assignedAt) events.push({ id: randomUUID(), complaintId: id, type: "HOLD", message: "On hold: waiting on the customer or a spare.", userId: creator.id, createdAt: assignedAt });
    if (closedAt) events.push({ id: randomUUID(), complaintId: id, type: "CLOSED", message: `Closed. Problem: ${problem?.name}. Solution: ${solution?.name}.`, userId: center.userId ?? creator.id, createdAt: closedAt });
    if (happyAt) events.push({ id: randomUUID(), complaintId: id, type: "HAPPY_CALL", message: "Happy calling recorded.", userId: callCentre.id, createdAt: happyAt });
    if (cancelledAt) events.push({ id: randomUUID(), complaintId: id, type: "CANCELLED", message: "Cancelled: customer withdrew the complaint.", userId: callCentre.id, createdAt: cancelledAt });
    if (escalationLevel > 0 && lastEscalatedAt) {
      const role = escalationLevel === 1 ? "AREA_MANAGER" : escalationLevel === 2 ? "STATE_HEAD" : "ADMIN";
      escalations.push({ id: randomUUID(), complaintId: id, fromLevel: escalationLevel - 1, toLevel: escalationLevel, toRole: role, toUserId: target?.id ?? null, reason: "Closing SLA breached", createdAt: lastEscalatedAt });
      events.push({ id: randomUUID(), complaintId: id, type: "ESCALATED", message: `Escalated to ${role}${target ? ` ${target.name}` : ""}.`, userId: admin.id, createdAt: lastEscalatedAt });
    }
  }

  await chunks(complaints, 15, (part) => prisma.complaint.createMany({ data: part }));
  await chunks(events, 80, (part) => prisma.complaintEvent.createMany({ data: part }));
  await chunks(escalations, 80, (part) => prisma.escalationLog.createMany({ data: part }));

  const recent = complaints.slice(0, 8);
  await prisma.notificationLog.createMany({
    data: recent.map((complaint, index) => ({
      complaintId: complaint.id,
      event: index % 2 === 0 ? "BOOKING" : "ASSIGNMENT",
      channel: index % 3 === 0 ? "whatsapp" : "sms",
      toAddress: customers[index].phone,
      body: `Oswal Pumps: complaint ${complaint.ticketNumber} update.`,
      provider: "console",
      status: "SENT",
      createdAt: complaint.createdAt,
    })),
  });
  await prisma.auditLog.create({ data: { entity: "seed", action: "load", userId: admin.id, changes: JSON.stringify({ complaints: complaints.length, customers: customers.length }) } });

  const sampleDir = path.join(process.cwd(), "samples");
  mkdirSync(sampleDir, { recursive: true });
  const sampleFile = path.join(sampleDir, "smartlogics-import.xlsx");
  writeFileSync(sampleFile, buildSampleWorkbook());

  console.log(`Seeded ${complaints.length} complaints, ${customers.length} customers, ${products.length} products.`);
  console.log(`Sample import: ${sampleFile}`);
  console.log("Demo admin: admin@oswalpumps.local / Admin@123");
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
