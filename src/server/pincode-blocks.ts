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
