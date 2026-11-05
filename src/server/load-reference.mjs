import {
  BRANDS, CAPACITIES, CATEGORIES, DISTRICTS, HOLDS, NATURES, PINCODES, PROBLEMS, PRODUCTS, SCHEMES, SOURCES, SOLUTIONS, STATES,
} from "../data/reference.mjs";

async function ensure(find, create) {
  const row = await find();
  if (row) return { row, created: false };
  return { row: await create(), created: true };
}

/** Insert missing reference rows. Existing names, codes and zones are left as they are. */
export async function loadReference(prisma) {
  let created = 0;
  const companies = await prisma.company.findMany();
  const byCode = new Map(companies.map((company) => [company.code, company]));
  for (const [name, code, zone] of STATES) {
    const found = await prisma.state.findUnique({ where: { name } });
    if (!found) {
      await prisma.state.create({ data: { name, code, zone } });
      created += 1;
    }
  }
  const states = await prisma.state.findMany();
  const stateByName = new Map(states.map((state) => [state.name, state]));
  for (const [stateName, districts] of Object.entries(DISTRICTS)) {
    const state = stateByName.get(stateName);
    if (!state) continue;
    for (const name of districts) {
      const found = await prisma.district.findUnique({ where: { stateId_name: { stateId: state.id, name } } });
      if (!found) {
        await prisma.district.create({ data: { name, stateId: state.id } });
        created += 1;
      }
    }
  }
  for (const [name, companyCode] of CATEGORIES) {
    const found = await prisma.category.findUnique({ where: { name } });
    if (!found) {
      await prisma.category.create({ data: { name, companyCode } });
      created += 1;
    }
  }
  const categories = await prisma.category.findMany();
  const categoryByName = new Map(categories.map((row) => [row.name, row]));
  for (const label of CAPACITIES) {
    const found = await prisma.hpCapacity.findUnique({ where: { label } });
    if (!found) {
      await prisma.hpCapacity.create({ data: { label } });
      created += 1;
    }
  }
  for (const [sku, name, categoryName, companyCode, type] of PRODUCTS) {
    const company = byCode.get(companyCode);
    if (!company) continue;
    const found = await prisma.product.findUnique({ where: { companyId_sku: { companyId: company.id, sku } } });
    if (!found) {
      await prisma.product.create({
        data: { companyId: company.id, sku, name, type, categoryId: categoryByName.get(categoryName)?.id },
      });
      created += 1;
    }
  }
  for (const company of companies) {
    for (const name of BRANDS) {
      const found = await prisma.brand.findUnique({ where: { companyId_name: { companyId: company.id, name } } });
      if (!found) {
        await prisma.brand.create({ data: { companyId: company.id, name } });
        created += 1;
      }
    }
  }
  for (const name of NATURES) {
    const result = await ensure(() => prisma.complaintIssue.findUnique({ where: { name } }), () => prisma.complaintIssue.create({ data: { name } }));
    if (result.created) created += 1;
  }
  for (const name of PROBLEMS) {
    const result = await ensure(() => prisma.actualProblem.findUnique({ where: { name } }), () => prisma.actualProblem.create({ data: { name } }));
    if (result.created) created += 1;
  }
  for (const name of SOLUTIONS) {
    const result = await ensure(() => prisma.actualSolution.findUnique({ where: { name } }), () => prisma.actualSolution.create({ data: { name } }));
    if (result.created) created += 1;
  }
  for (const name of SCHEMES) {
    const result = await ensure(() => prisma.scheme.findUnique({ where: { name } }), () => prisma.scheme.create({ data: { name } }));
    if (result.created) created += 1;
  }
  for (const [code, name] of SOURCES) {
    const found = await prisma.complaintSource.findUnique({ where: { code } });
    if (!found) {
      await prisma.complaintSource.create({ data: { code, name } });
      created += 1;
    }
  }
  for (const name of HOLDS) {
    const found = await prisma.holdStatus.findUnique({ where: { name } });
    if (!found) {
      await prisma.holdStatus.create({ data: { name } });
      created += 1;
    }
  }
  const pinResult = await importPincodes(prisma, PINCODES.map(([code, district, state]) => ({ code, district, state })));
  created += pinResult.created;
  return { created };
}

export async function importPincodes(prisma, rows) {
  let created = 0;
  let skipped = 0;
  for (const row of rows) {
    const state = await prisma.state.findFirst({ where: { name: { equals: row.state, mode: "insensitive" } } });
    if (!state) { skipped += 1; continue; }
    let district = await prisma.district.findFirst({ where: { stateId: state.id, name: { equals: row.district, mode: "insensitive" } } });
    if (!district) {
      district = await prisma.district.create({ data: { name: row.district, stateId: state.id } });
      created += 1;
    }
    const existing = await prisma.pincode.findUnique({ where: { code: row.code } });
    if (!existing) {
      await prisma.pincode.create({ data: { code: row.code, districtId: district.id } });
      created += 1;
    }
  }
  return { created, skipped };
}
