import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

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
    data: { id: "co_pumps", code: "PUMPS", name: "Oswal Pumps", legalName: "Oswal Pumps Ltd", shortName: "Oswal Pumps", accent: "#02502f", logoText: "OP", tagline: "Pumps and motors", address: "Karnal, Haryana" },
  });
  const solar = await prisma.company.create({
    data: { id: "co_solar", code: "SOLAR", name: "Oswal Solar", legalName: "Oswal Solar Energy", shortName: "Oswal Solar", accent: "#FFC61A", logoText: "OS", tagline: "Panels and inverters", address: "Karnal, Haryana" },
  });
  await prisma.user.create({
    data: {
      name: "Desk Admin",
      email: "admin@oswal.test",
      passwordHash: await bcrypt.hash("Admin@123", 8),
      role: "ADMIN",
      phone: "9810000001",
      memberships: { create: [{ companyId: pumps.id }, { companyId: solar.id }] },
    },
  });
  console.log("Seeded login only. admin@oswal.test / Admin@123");
}

main().finally(() => prisma.$disconnect());
