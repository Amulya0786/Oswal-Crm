import { prisma } from "./db";

type Row = {
  pincode?: string;
  blockLgdCode?: string;
  blockName?: string;
  districtName?: string;
  stateName?: string;
};

function same(left?: string | null, right?: string | null) {
  return (left ?? "").trim().toLowerCase() === (right ?? "").trim().toLowerCase();
}

export async function linkPincodeBlocks(rows: Row[]) {
  const reasons: Record<string, number> = {};
  let linked = 0;
  let skipped = 0;
  function skip(reason: string) {
    skipped += 1;
    reasons[reason] = (reasons[reason] ?? 0) + 1;
  }
  for (const row of rows) {
    const code = String(row.pincode ?? "").trim();
    if (!/^[1-9]\d{5}$/.test(code)) {
      skip("invalid pincode");
      continue;
    }
    const pin = await prisma.pincode.findUnique({ where: { code }, include: { district: { include: { state: true } } } });
    if (!pin) {
      skip("unknown pincode");
      continue;
    }
    if (row.districtName && !same(row.districtName, pin.district.name)) {
      skip("district mismatch");
      continue;
    }
    if (row.stateName && !same(row.stateName, pin.district.state.name)) {
      skip("state mismatch");
      continue;
    }
    const lgd = String(row.blockLgdCode ?? "").trim();
    const name = String(row.blockName ?? "").trim();
    const block = lgd
      ? await prisma.tehsil.findFirst({ where: { districtId: pin.districtId, lgdCode: lgd, active: true } })
      : name
        ? await prisma.tehsil.findFirst({ where: { districtId: pin.districtId, name: { equals: name, mode: "insensitive" }, active: true } })
        : null;
    if (!block) {
      skip("block not in this district");
      continue;
    }
    if (pin.blockId !== block.id) {
      await prisma.pincode.update({ where: { id: pin.id }, data: { blockId: block.id } });
    }
    linked += 1;
  }
  return { linked, skipped, reasons };
}

function blockKey(value: string) {
  return value.toLowerCase().replace(/\b(block|mandal|taluk|taluka|tehsil|subdistrict|sub district)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function near(left: string, right: string) {
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  if (Math.abs(left.length - right.length) > 2) return false;
  let changes = 0;
  const size = Math.max(left.length, right.length);
  for (let index = 0; index < size; index += 1) if (left[index] !== right[index]) changes += 1;
  return changes <= 2;
}

/** Link pincodes that have no tehsil, then mark urban pins from the city master. */
export async function linkLoosePincodes() {
  const tehsils = await prisma.tehsil.findMany({ where: { active: true }, select: { id: true, name: true, districtId: true } });
  const byDistrict = new Map<string, { id: string; key: string; name: string }[]>();
  for (const tehsil of tehsils) {
    const list = byDistrict.get(tehsil.districtId) ?? [];
    list.push({ id: tehsil.id, key: blockKey(tehsil.name), name: tehsil.name });
    byDistrict.set(tehsil.districtId, list);
  }
  const pins = await prisma.pincode.findMany({
    where: { blockId: null },
    include: { area: true, district: true },
    take: 8000,
  });
  let matched = 0;
  let approximate = 0;
  for (const pin of pins) {
    const options = byDistrict.get(pin.districtId) ?? [];
    const wanted = blockKey(pin.area?.name ?? "");
    const hit = wanted ? options.find((option) => near(option.key, wanted)) : null;
    if (hit) {
      await prisma.pincode.update({ where: { id: pin.id }, data: { blockId: hit.id, blockApproximate: false } });
      matched += 1;
      continue;
    }
    const hq = options.find((option) => near(option.key, blockKey(pin.district.name)));
    if (hq) {
      await prisma.pincode.update({ where: { id: pin.id }, data: { blockId: hq.id, blockApproximate: true } });
      approximate += 1;
    }
  }
  const cities = await prisma.city.findMany({ where: { active: true }, select: { id: true, pincodes: true } });
  let urban = 0;
  for (const city of cities) {
    const codes = city.pincodes.split(/[^0-9]+/).filter((code) => /^[1-9]\d{5}$/.test(code));
    if (!codes.length) continue;
    const result = await prisma.pincode.updateMany({ where: { code: { in: codes } }, data: { cityId: city.id, urban: true } });
    urban += result.count;
  }
  const stillOpen = await prisma.pincode.count({ where: { blockId: null, urban: false } });
  return { matched, approximate, urban, stillOpen };
}
