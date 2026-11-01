import { execSync } from "child_process";
import { rmSync } from "fs";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("complaint lifecycle and import", () => {
  const database = path.join(process.cwd(), "prisma", "test.db");

  beforeAll(() => {
    rmSync(database, { force: true });
    rmSync(`${database}-journal`, { force: true });
    execSync("npx prisma db push --skip-generate --accept-data-loss", {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: "file:./test.db" },
      stdio: "pipe",
    });
  });

  afterAll(async () => {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$disconnect();
  });

  it("books, escalates, closes and imports", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { hashPassword } = await import("@/lib/password");
    const { bookComplaint, actOnComplaint } = await import("@/server/complaints");
    const { runEscalation } = await import("@/server/escalation");
    const { runImport } = await import("@/server/importer");
    const passwordHash = hashPassword("Admin@123");
    const state = await prisma.state.create({ data: { name: "Haryana", code: "HR" } });
    const district = await prisma.district.create({ data: { name: "Karnal", stateId: state.id } });
    const brand = await prisma.brand.create({ data: { name: "Oswal", code: "OSW" } });
    const product = await prisma.product.create({ data: { sku: "OSP-V4-100", name: "Oswal V4 Submersible 1 HP", family: "Submersible", brandId: brand.id } });
    const problem = await prisma.actualProblem.create({ data: { name: "Winding burnt" } });
    const solution = await prisma.actualSolution.create({ data: { name: "Rewound motor", problemId: problem.id } });
    const admin = await prisma.user.create({ data: { name: "Asha Malik", email: "admin@oswalpumps.local", employeeCode: "OPL-ADM-001", role: "ADMIN", passwordHash } });
    const area = await prisma.user.create({ data: { name: "Vikram Singh", email: "am.karnal@oswalpumps.local", employeeCode: "OPL-AM-KNL", role: "AREA_MANAGER", phone: "9811100021", passwordHash } });
    const head = await prisma.user.create({ data: { name: "Suresh Kaushik", email: "sh.haryana@oswalpumps.local", employeeCode: "OPL-SH-HR", role: "STATE_HEAD", phone: "9811100011", passwordHash } });
    const tech = await prisma.user.create({ data: { name: "Raju Singh", email: "tech.karnal@oswalpumps.local", employeeCode: "OPL-TECH-01", role: "TECHNICIAN", phone: "9811101000", passwordHash } });
    await prisma.userStateAccess.create({ data: { userId: area.id, stateId: state.id } });
    await prisma.userDistrictAccess.create({ data: { userId: area.id, districtId: district.id } });
    await prisma.userStateAccess.create({ data: { userId: head.id, stateId: state.id } });
    const center = await prisma.serviceCenter.create({
      data: { code: "SC-HR-132001", name: "Karnal Service Centre", engineerName: "Raju Singh", userId: tech.id, stateId: state.id, districtId: district.id, isDefault: true },
    });
    await prisma.pincode.create({ data: { code: "132001", stateId: state.id, districtId: district.id, serviceCenterId: center.id } });
    await prisma.slaPolicy.create({ data: { complaintType: "BREAKDOWN", responseHours: 4, closeHours: 48, escalationCooldownHours: 12 } });
    await prisma.notificationTemplate.create({ data: { event: "BOOKING", channel: "sms", body: "Ticket {{ticketNumber}} for {{customerName}}" } });

    const actor = { id: admin.id, name: admin.name, email: admin.email, role: "ADMIN", employeeCode: admin.employeeCode, phone: null, stateIds: [], districtIds: [], brandIds: [] };
    const booked = await bookComplaint(
      {
        customerName: "Baldev Singh",
        phone: "9811000001",
        stateId: state.id,
        districtId: district.id,
        pincode: "132001",
        serialNumber: "OSW00001",
        productId: product.id,
        type: "BREAKDOWN",
        source: "CALL",
        description: "Motor hums and does not pick up.",
      },
      actor,
    );
    expect(booked?.ticketNumber).toBe("OPL10001");
    expect(booked?.status).toBe("ASSIGNED");
    expect(booked?.serviceCenterId).toBe(center.id);

    const past = new Date(Date.now() - 3 * 86_400_000);
    await prisma.complaint.update({ where: { id: booked!.id }, data: { slaCloseDue: past, slaResponseDue: past } });
    const first = await runEscalation(admin.id, { force: true });
    expect(first.escalated).toBe(1);
    const escalated = await prisma.complaint.findUniqueOrThrow({ where: { id: booked!.id }, include: { escalations: true } });
    expect(escalated.escalationLevel).toBe(1);
    expect(escalated.escalations[0]?.toRole).toBe("AREA_MANAGER");
    expect(escalated.escalations[0]?.toUserId).toBe(area.id);

    await actOnComplaint(booked!.id, actor, { type: "close", actualProblemId: problem.id, actualSolutionId: solution.id, closeNotes: "Rewound on site.", checklistIds: [] });
    await actOnComplaint(booked!.id, actor, { type: "happy", rating: 5, notes: "Pump is running." });
    const closed = await prisma.complaint.findUniqueOrThrow({ where: { id: booked!.id }, include: { events: true } });
    expect(closed.status).toBe("HAPPY_CALLING_DONE");
    expect(closed.happyRating).toBe(5);
    expect(closed.events.map((event) => event.type)).toEqual(expect.arrayContaining(["BOOKED", "ASSIGNED", "ESCALATED", "CLOSED", "HAPPY_CALL"]));

    const imported = await runImport({
      entity: "customers",
      rows: [{ Name: "Imported Farmer", Mobile: "9811191099", State: "Haryana", District: "Karnal", Village: "Nilokheri" }],
      mapping: { customerName: "Name", phone: "Mobile", state: "State", district: "District", village: "Village" },
      user: actor,
      write: true,
    });
    expect(imported.created).toBe(1);
    expect(imported.failedCount).toBe(0);
    const farmer = await prisma.customer.findFirstOrThrow({ where: { phone: "9811191099" } });
    expect(farmer.name).toBe("Imported Farmer");
    expect(farmer.districtId).toBe(district.id);
  });
});
