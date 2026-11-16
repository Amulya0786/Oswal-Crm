import { mkdirSync } from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { COMPANIES, PROOF_DEFAULT, SLA_HOURS, adminBootstrapError } from "./bootstrap-rules.mjs";
import { loadReference } from "../src/server/load-reference.mjs";
import { runtimeDatabaseUrl } from "./db-url.mjs";

const databaseUrl = runtimeDatabaseUrl(process.env.DATABASE_URL);
const prisma = new PrismaClient(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined);

function ensureStorage() {
  const root = process.env.STORAGE_DIR;
  if (!root) return;
  for (const folder of ["uploads", "imports", "summaries", "exports"]) {
    mkdirSync(path.join(root, folder), { recursive: true });
  }
}

function assertProductionSecrets() {
  if (process.env.NODE_ENV !== "production") return;
  for (const key of ["AUTH_SECRET", "CRON_SECRET", "OSWAL_API_KEY"]) {
    const value = process.env[key] ?? "";
    if (value.length < 24 || value.startsWith("enter-")) {
      console.error(`${key} is still a placeholder. Replace it with a long random string in DigitalOcean, then redeploy.`);
      process.exit(1);
    }
  }
  const spacesKey = process.env.S3_ACCESS_KEY ?? "";
  if (!spacesKey || spacesKey.startsWith("enter-")) {
    console.error("S3_ACCESS_KEY and S3_SECRET_KEY are not set. Photos will not survive a redeploy until the Singapore Space keys are pasted in.");
  }
}

async function ensureConfig() {
  await prisma.dataVersion.upsert({ where: { id: 1 }, create: { id: 1, version: 1 }, update: {} });
  for (const company of COMPANIES) {
    const row = await prisma.company.upsert({
      where: { code: company.code },
      create: company,
      update: {
        name: company.name,
        legalName: company.legalName,
        shortName: company.shortName,
        accent: company.accent,
        logoText: company.logoText,
        tagline: company.tagline,
      },
    });
    for (const [callType, hours] of Object.entries(SLA_HOURS)) {
      await prisma.slaPolicy.upsert({
        where: { companyId_callType: { companyId: row.id, callType } },
        create: { companyId: row.id, callType, hours, warnPercent: 75, active: true },
        update: {},
      });
    }
  }
  for (const callType of Object.keys(SLA_HOURS)) {
    await prisma.proofRule.upsert({
      where: { callType },
      create: { callType, ...PROOF_DEFAULT },
      update: {},
    });
  }
}

async function ensureAdmin() {
  const userCount = await prisma.user.count();
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_INITIAL_PASSWORD;
  const problem = adminBootstrapError(userCount, email, password);
  if (problem) {
    console.error(problem);
    console.error("Enter ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD in DigitalOcean, then redeploy. No demo users are created.");
    process.exit(1);
  }
  if (userCount > 0) {
    console.log("Users already exist. Leaving accounts unchanged.");
    return;
  }
  const companies = await prisma.company.findMany({ where: { code: { in: COMPANIES.map((row) => row.code) } } });
  await prisma.user.create({
    data: {
      name: "Service admin",
      email: email.trim().toLowerCase(),
      passwordHash: await bcrypt.hash(password, 10),
      role: "ADMIN",
      mustChangePassword: true,
      memberships: { create: companies.map((company) => ({ companyId: company.id })) },
    },
  });
  console.log(`Created the first admin ${email.trim().toLowerCase()}. Password change is required at first login.`);
}

assertProductionSecrets();
ensureStorage();
await ensureConfig();
await loadReference(prisma);
await ensureAdmin();
await prisma.$disconnect();
