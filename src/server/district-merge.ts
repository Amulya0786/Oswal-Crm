import { readFile } from "fs/promises";
import { prisma } from "./db";
import { mastersFile, mergeDistricts } from "./places";

function norm(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

const SPLIT: Record<string, string[]> = {
  anupgarh: ["bikaner", "sri ganganagar"],
  "neem ka thana": ["jhunjhunu", "sikar"],
};

export async function aliasMergePlan() {
  const aliases = await prisma.placeAlias.findMany({
    where: { kind: "district" },
    include: { district: { include: { state: true } } },
    orderBy: [{ stateName: "asc" }, { alias: "asc" }],
  });
  const rows = [];
  for (const alias of aliases) {
    const from = await prisma.district.findFirst({
      where: {
        stateId: alias.district.stateId,
        active: true,
        name: { equals: alias.alias, mode: "insensitive" },
        NOT: { id: alias.districtId },
      },
    });
    const key = norm(alias.alias);
    const mode = key === "assandh" ? "tehsil" : SPLIT[key] ? "split" : "merge";
    if (!from) {
      rows.push({ alias: alias.alias, state: alias.stateName, into: alias.district.name, mode, status: "already one district", tickets: 0, customers: 0, pincodes: 0, tehsils: 0 });
      continue;
    }
    const [tickets, customers, pincodes, tehsils, engineers] = await Promise.all([
      prisma.complaint.count({ where: { districtId: from.id } }),
      prisma.customer.count({ where: { districtId: from.id } }),
      prisma.pincode.count({ where: { districtId: from.id } }),
      prisma.tehsil.count({ where: { districtId: from.id } }),
      prisma.engineerDistrict.count({ where: { districtId: from.id } }),
    ]);
    rows.push({
      fromId: from.id,
      toId: alias.districtId,
      alias: alias.alias,
      state: alias.stateName,
      into: alias.district.name,
      mode,
      status: "ready",
      tickets,
      customers,
      pincodes,
      tehsils,
      engineers,
    });
  }
  return { dryRun: true, rows };
}

async function tehsilParents() {
  const file = await readFile(await mastersFile("tehsils.csv"), "utf8");
  const map = new Map<string, string>();
  for (const line of file.split(/\r?\n/).slice(1)) {
    const [state, district, tehsil] = line.split(",");
    if (!state || !district || !tehsil) continue;
    map.set(`${norm(state)}|${norm(tehsil)}`, district.trim());
  }
  return map;
}

export async function applyAliasMerges(userId: string) {
  const plan = await aliasMergePlan();
  const parents = await tehsilParents();
  const done = [];
  for (const row of plan.rows) {
    if (row.status !== "ready" || !row.fromId || !row.toId) {
      done.push(row);
      continue;
    }
    if (row.mode === "split") {
      const allowed = new Set(SPLIT[norm(row.alias)] ?? []);
      const tehsils = await prisma.tehsil.findMany({ where: { districtId: row.fromId } });
      let moved = 0;
      for (const tehsil of tehsils) {
        const parentName = parents.get(`${norm(row.state)}|${norm(tehsil.name)}`);
        if (!parentName || !allowed.has(norm(parentName))) continue;
        const parent = await prisma.district.findFirst({
          where: { state: { name: { equals: row.state, mode: "insensitive" } }, name: { equals: parentName, mode: "insensitive" }, active: true },
        });
        if (!parent) continue;
        const pins = await prisma.pincode.findMany({ where: { blockId: tehsil.id }, select: { code: true } });
        await prisma.tehsil.update({ where: { id: tehsil.id }, data: { districtId: parent.id } });
        await prisma.pincode.updateMany({ where: { blockId: tehsil.id }, data: { districtId: parent.id } });
        if (pins.length) {
          await prisma.complaint.updateMany({
            where: { pincode: { in: pins.map((pin) => pin.code) } },
            data: { districtId: parent.id, districtName: parent.name, tehsilId: tehsil.id },
          });
        }
        await prisma.complaint.updateMany({
          where: { tehsilId: tehsil.id },
          data: { districtId: parent.id, districtName: parent.name },
        });
        moved += 1;
      }
      const left = await prisma.tehsil.count({ where: { districtId: row.fromId } });
      done.push({ ...row, status: "split", moved, tehsilsLeft: left });
      continue;
    }
    if (row.mode === "tehsil") {
      const tehsil = await prisma.tehsil.upsert({
        where: { districtId_name: { districtId: row.toId, name: "Assandh" } },
        create: { districtId: row.toId, name: "Assandh" },
        update: {},
      });
      await prisma.pincode.updateMany({ where: { districtId: row.fromId }, data: { districtId: row.toId, blockId: tehsil.id } });
      await prisma.complaint.updateMany({
        where: { districtId: row.fromId },
        data: { districtId: row.toId, districtName: row.into, tehsilId: tehsil.id },
      });
      await prisma.customer.updateMany({ where: { districtId: row.fromId }, data: { districtId: row.toId } });
    }
    await mergeDistricts(row.fromId, row.toId, userId);
    done.push({ ...row, status: "merged" });
  }
  return { dryRun: false, rows: done };
}
