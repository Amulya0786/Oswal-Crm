import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { nextTicketNo } from "../src/server/ticket-seq";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    DO $$ DECLARE r RECORD;
    BEGIN
      FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);
  await prisma.dataVersion.create({ data: { id: 1, version: 1 } });
  const pumps = await prisma.company.create({
    data: { id: "co_pumps", code: "PUMPS", name: "Oswal Pumps", legalName: "Oswal Pumps Ltd", shortName: "Oswal Pumps", accent: "#1f4e89", logoText: "OP", tagline: "Pumps and motors", address: "Karnal, Haryana" },
  });
  const solar = await prisma.company.create({
    data: { id: "co_solar", code: "SOLAR", name: "Oswal Solar", legalName: "Oswal Solar Energy", shortName: "Oswal Solar", accent: "#c2410c", logoText: "OS", tagline: "Solar pumps", address: "Karnal, Haryana" },
  });
  const haryana = await prisma.state.create({ data: { id: "st_haryana", name: "Haryana", code: "HR" } });
  const maharashtra = await prisma.state.create({ data: { id: "st_maharashtra", name: "Maharashtra", code: "MH" } });
  const karnal = await prisma.district.create({ data: { id: "dt_karnal", name: "Karnal", stateId: haryana.id } });
  const dharashiv = await prisma.district.create({ data: { id: "dt_dharashiv", name: "Dharashiv", stateId: maharashtra.id } });
  const sambhajinagar = await prisma.district.create({ data: { id: "dt_sambhajinagar", name: "Chhatrapati Sambhajinagar", stateId: maharashtra.id } });
  await prisma.districtAlias.createMany({
    data: [
      { alias: "Osmanabad", districtId: dharashiv.id },
      { alias: "osmanabad", districtId: dharashiv.id },
      { alias: "Aurangabad", districtId: sambhajinagar.id },
      { alias: "aurangabad", districtId: sambhajinagar.id },
    ],
  });
  await prisma.pincode.createMany({
    data: [
      { code: "132001", districtId: karnal.id },
      { code: "413501", districtId: dharashiv.id },
      { code: "431001", districtId: sambhajinagar.id },
    ],
  });
  const pumpCategory = await prisma.category.create({ data: { name: "Solar Pump", companyCode: "PUMPS" } });
  const panelCategory = await prisma.category.create({ data: { name: "Solar Panel", companyCode: "SOLAR" } });
  await prisma.category.createMany({
    data: [
      { name: "Submersible Pump", companyCode: "PUMPS" },
      { name: "Monoblock Pump", companyCode: "PUMPS" },
      { name: "Controller", companyCode: "PUMPS" },
      { name: "Motor", companyCode: "PUMPS" },
      { name: "RMS", companyCode: "PUMPS" },
      { name: "Rooftop System", companyCode: "SOLAR" },
      { name: "Inverter", companyCode: "SOLAR" },
    ],
  });
  const hp = await prisma.hpCapacity.create({ data: { label: "5 HP" } });
  const pump = await prisma.product.create({
    data: { companyId: pumps.id, sku: "OSP-SP5", name: "5 HP Solar Submersible", type: "SOLAR", categoryId: pumpCategory.id, hpId: hp.id },
  });
  const panel = await prisma.product.create({
    data: { companyId: solar.id, sku: "OSS-P540", name: "540W Solar Panel", type: "PANEL", categoryId: panelCategory.id },
  });
  const brand = await prisma.brand.create({ data: { companyId: pumps.id, name: "OSWAL" } });
  await prisma.brand.create({ data: { companyId: solar.id, name: "OSWAL" } });
  const nature = await prisma.complaintIssue.create({ data: { name: "Motor not working" } });
  await prisma.actualProblem.create({ data: { name: "Motor burnt" } });
  await prisma.actualSolution.create({ data: { name: "Motor replaced" } });
  const engineer = await prisma.engineer.create({
    data: { id: "eng_anita", companyId: pumps.id, name: "Anita Sharma", kind: "ENGINEER", employeeCode: "PMP-101", stateId: haryana.id, districtId: karnal.id, pincodes: "132001", skills: "SOLAR,SUBMERSIBLE,INSTALLATION", phone: "9811100101" },
  });
  const passwordHash = await bcrypt.hash("Admin@123", 8);
  const admin = await prisma.user.create({
    data: {
      name: "Desk Admin", email: "admin@oswal.test", passwordHash, role: "ADMIN", phone: "9810000001",
      memberships: { create: [{ companyId: pumps.id }, { companyId: solar.id }] },
    },
  });
  await prisma.user.create({
    data: {
      name: "Dhananjay Test", email: "test.user@oswal.test", passwordHash: await bcrypt.hash("Test@123", 8), role: "CALL_CENTRE", isTest: true, phone: "8010460736",
      memberships: { create: [{ companyId: pumps.id }] },
    },
  });
  const calls = [
    { name: "Pawan Kumar", phone: "9811111001", serial: "HSO2707", pending: false, district: karnal, state: haryana, test: false },
    { name: "Savita Bhalekar", phone: "9811111002", serial: null, pending: true, district: dharashiv, state: maharashtra, test: false },
    { name: "Test Junk", phone: "8010460736", serial: null, pending: true, district: karnal, state: haryana, test: true },
  ];
  for (const row of calls) {
    const ticketNo = await nextTicketNo(new Date());
    await prisma.complaint.create({
      data: {
        ticketNo,
        companyId: pumps.id,
        bookDate: new Date(),
        customerName: row.name,
        phone: row.phone,
        stateId: row.state.id,
        districtId: row.district.id,
        stateName: row.state.name,
        districtName: row.district.name,
        callType: "BREAKDOWN",
        categoryId: pumpCategory.id,
        categoryName: pumpCategory.name,
        productId: pump.id,
        productDetails: pump.name,
        capacityLabel: "5 HP",
        serialNo: row.serial,
        serialNorm: row.serial,
        serialPending: row.pending,
        serialUnavailableReason: row.pending ? "STICKER_MISSING" : null,
        natureId: nature.id,
        natureText: nature.name,
        source: "CALL",
        callBy: "Seed",
        status: "OPEN",
        finalStatus: "Open",
        brandId: brand.id,
        brandName: brand.name,
        channel: "FIELD",
        excludeFromMis: row.test,
        engineerId: engineer.id,
        assignedName: engineer.name,
        assignedAt: new Date(),
        createdById: admin.id,
        slaHours: 48,
        slaDueAt: new Date(Date.now() + 48 * 3600 * 1000),
      },
    });
  }
  const solarBrand = await prisma.brand.findFirst({ where: { companyId: solar.id, name: "OSWAL" } });
  const panelTicket = await nextTicketNo(new Date());
  await prisma.complaint.create({
    data: {
      ticketNo: panelTicket,
      companyId: solar.id,
      bookDate: new Date(),
      customerName: "Meera Joshi",
      phone: "9811111003",
      stateId: haryana.id,
      districtId: karnal.id,
      stateName: haryana.name,
      districtName: karnal.name,
      callType: "BREAKDOWN",
      categoryId: panelCategory.id,
      categoryName: panelCategory.name,
      productId: panel.id,
      productDetails: panel.name,
      serialPending: true,
      serialUnavailableReason: "STICKER_MISSING",
      natureText: "Panel output low",
      source: "CALL",
      callBy: "Seed",
      status: "OPEN",
      finalStatus: "Open",
      brandId: solarBrand?.id,
      brandName: "OSWAL",
      channel: "FIELD",
      createdById: admin.id,
      slaHours: 48,
      slaDueAt: new Date(Date.now() + 48 * 3600 * 1000),
    },
  });
  console.log("Seeded demo desk. Admin admin@oswal.test / Admin@123");
}

main().finally(() => prisma.$disconnect());
