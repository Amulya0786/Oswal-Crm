import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "./db";
import { HttpError } from "./http";

function norm(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function searchPlaces(kind: string, q: string, stateId?: string | null, districtId?: string | null) {
  const query = q.trim();
  if (kind === "pin" && /^[1-9]\d{5}$/.test(query)) {
    const pin = await prisma.pincode.findUnique({ where: { code: query }, include: { district: { include: { state: true } }, area: true } });
    if (!pin) return [];
    return [{ id: pin.id, label: pin.code, districtId: pin.districtId, district: `${pin.district.name}, ${pin.district.state.name}`, stateId: pin.district.stateId, state: pin.district.state.name, areaId: pin.areaId, area: pin.area?.name ?? "" }];
  }
  if (query.length < 2 && kind !== "tehsil" && kind !== "city") return [];
  if (kind === "district") {
    const rows = await prisma.district.findMany({
      where: { active: true, ...(stateId ? { stateId } : {}), ...(query ? { name: { contains: query, mode: "insensitive" } } : {}) },
      include: { state: true },
      orderBy: { name: "asc" },
      take: 20,
    });
    return rows.map((row) => ({ id: row.id, label: `${row.name}, ${row.state.name}`, stateId: row.stateId, state: row.state.name }));
  }
  if (kind === "area" && districtId) {
    const rows = await prisma.area.findMany({
      where: { districtId, active: true, ...(query ? { name: { contains: query, mode: "insensitive" } } : {}) },
      orderBy: { name: "asc" },
      take: 20,
    });
    return rows.map((row) => ({ id: row.id, label: row.name, districtId }));
  }
  if (kind === "tehsil" && districtId) {
    const rows = await prisma.tehsil.findMany({
      where: { districtId, active: true, ...(query ? { name: { contains: query, mode: "insensitive" } } : {}) },
      orderBy: { name: "asc" },
      take: 20,
    });
    return rows.map((row) => ({ id: row.id, label: row.name, districtId }));
  }
  if (kind === "city" && districtId) {
    const rows = await prisma.city.findMany({
      where: { districtId, active: true, ...(query ? { name: { contains: query, mode: "insensitive" } } : {}) },
      orderBy: { name: "asc" },
      take: 20,
    });
    return rows.map((row) => ({ id: row.id, label: row.name, districtId, pincodes: row.pincodes }));
  }
  return [];
}

export async function resolveDistrict(stateName: string, districtName: string) {
  const state = await prisma.state.findFirst({ where: { name: { equals: stateName.trim(), mode: "insensitive" } } });
  if (!state) return null;
  const alias = await prisma.placeAlias.findFirst({
    where: { kind: "district", stateName: state.name, alias: { equals: districtName.trim(), mode: "insensitive" } },
  });
  if (alias) return prisma.district.findUnique({ where: { id: alias.districtId } });
  return prisma.district.findFirst({ where: { stateId: state.id, name: { equals: districtName.trim(), mode: "insensitive" }, active: true } });
}

export async function mergeDistricts(fromId: string, toId: string, userId: string) {
  if (fromId === toId) throw new HttpError(400, "Choose two different districts");
  const [from, to] = await Promise.all([
    prisma.district.findUnique({ where: { id: fromId }, include: { state: true, areas: true } }),
    prisma.district.findUnique({ where: { id: toId }, include: { state: true, areas: true } }),
  ]);
  if (!from || !to) throw new HttpError(404, "District not found");
  if (from.stateId !== to.stateId) throw new HttpError(400, "Districts must be in the same state");
  await prisma.$transaction(async (tx) => {
    const targetAreas = new Map(to.areas.map((area) => [norm(area.name), area.id]));
    for (const area of from.areas) {
      const existing = targetAreas.get(norm(area.name));
      if (existing) {
        await tx.pincode.updateMany({ where: { areaId: area.id }, data: { areaId: existing, districtId: to.id } });
        await tx.complaint.updateMany({ where: { areaId: area.id }, data: { areaId: existing, districtId: to.id, districtName: to.name, stateName: to.state.name } });
        await tx.customer.updateMany({ where: { areaId: area.id }, data: { areaId: existing, districtId: to.id } });
        await tx.area.update({ where: { id: area.id }, data: { active: false } });
      } else {
        await tx.area.update({ where: { id: area.id }, data: { districtId: to.id } });
      }
    }
    await tx.pincode.updateMany({ where: { districtId: from.id }, data: { districtId: to.id } });
    await tx.complaint.updateMany({ where: { districtId: from.id }, data: { districtId: to.id, districtName: to.name } });
    await tx.customer.updateMany({ where: { districtId: from.id }, data: { districtId: to.id } });
    await tx.engineer.updateMany({ where: { districtId: from.id }, data: { districtId: to.id } });
    await tx.engineerDistrict.deleteMany({ where: { districtId: from.id } });
    await tx.tehsil.updateMany({ where: { districtId: from.id }, data: { districtId: to.id } });
    await tx.city.updateMany({ where: { districtId: from.id }, data: { districtId: to.id } });
    await tx.district.update({ where: { id: from.id }, data: { active: false, mergedIntoId: to.id } });
    await tx.auditLog.create({
      data: { userId, entity: "District", entityId: from.id, action: "MERGE", summary: `Merged ${from.name} into ${to.name}`, before: { id: from.id }, after: { into: to.id } },
    });
  });
  return { ok: true, from: from.name, to: to.name };
}

function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const header = lines.shift()?.split(",") ?? [];
  return lines.map((line) => {
    const cells: string[] = [];
    let current = "";
    let quoted = false;
    for (const char of line) {
      if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { cells.push(current); current = ""; }
      else current += char;
    }
    cells.push(current);
    const row: Record<string, string> = {};
    header.forEach((key, index) => { row[key.trim()] = (cells[index] ?? "").trim(); });
    return row;
  });
}

export async function seedDistrictAliases() {
  const file = await readFile(path.join(process.cwd(), "data/masters/district_cleanup.csv"), "utf8");
  const rows = parseCsv(file);
  let aliases = 0;
  const proposals = [];
  for (const row of rows) {
    const action = row.action ?? "";
    const state = await prisma.state.findFirst({ where: { name: { equals: row.state, mode: "insensitive" } } });
    if (!state) continue;
    const canonical = await prisma.district.findFirst({
      where: { stateId: state.id, OR: [{ id: row.canonical_app_district_id }, { name: { equals: row.canonical_app_district_name, mode: "insensitive" } }] },
    });
    if (!canonical) continue;
    if (action.startsWith("MERGE") && norm(row.app_district_name) !== norm(canonical.name)) {
      await prisma.placeAlias.upsert({
        where: { kind_stateName_alias: { kind: "district", stateName: state.name, alias: row.app_district_name } },
        create: { kind: "district", stateName: state.name, alias: row.app_district_name, districtId: canonical.id },
        update: { districtId: canonical.id },
      });
      aliases += 1;
      proposals.push({ fromId: row.app_district_id, from: row.app_district_name, toId: canonical.id, to: canonical.name, state: state.name });
    }
  }
  return { aliases, proposals };
}

async function districtId(stateName: string, districtName: string) {
  const state = await prisma.state.findFirst({ where: { name: { equals: stateName, mode: "insensitive" } } });
  if (!state) return null;
  const district = await prisma.district.findFirst({ where: { stateId: state.id, name: { equals: districtName, mode: "insensitive" } } });
  return district?.id ?? null;
}

export async function seedTehsils() {
  const file = await readFile(path.join(process.cwd(), "data/masters/tehsils.csv"), "utf8");
  const rows = parseCsv(file);
  let created = 0;
  for (const row of rows) {
    const id = await districtId(row.state, row.district);
    if (!id || !row.tehsil) continue;
    const existing = await prisma.tehsil.findUnique({ where: { districtId_name: { districtId: id, name: row.tehsil } } });
    if (existing) continue;
    await prisma.tehsil.create({ data: { districtId: id, name: row.tehsil, lgdCode: row.lgd_subdistrict_code || null } });
    created += 1;
  }
  return { created, rows: rows.length };
}

export async function seedCities() {
  const file = await readFile(path.join(process.cwd(), "data/masters/cities.csv"), "utf8");
  const rows = parseCsv(file);
  let created = 0;
  for (const row of rows) {
    const name = row["city_town (urban local body)"] || row.city_town || row.city;
    const id = await districtId(row.state, row.district);
    if (!id || !name) continue;
    const existing = await prisma.city.findUnique({ where: { districtId_name: { districtId: id, name } } });
    if (existing) continue;
    await prisma.city.create({ data: { districtId: id, name, kind: row.type || null, pincodes: row.pincodes || "", lgdCode: row.lgd_local_body_code || null } });
    created += 1;
  }
  return { created, rows: rows.length };
}
