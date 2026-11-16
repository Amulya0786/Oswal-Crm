import { Prisma, PrismaClient } from "@prisma/client";
import { runtimeDatabaseUrl } from "./db-url";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Dynamic lookup so the build does not bake the image's placeholder URL into the server.
const databaseUrl = runtimeDatabaseUrl(process.env["DATABASE_URL"]);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.PRISMA_LOG === "1" ? ["query", "error"] : ["error"],
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function bumpVersion(tx: Prisma.TransactionClient | PrismaClient = prisma) {
  await tx.$executeRaw`UPDATE "DataVersion" SET "version" = "version" + 1 WHERE "id" = 1`;
}

export async function getVersion() {
  const rows = await prisma.$queryRaw<{ version: number }[]>`SELECT "version" FROM "DataVersion" WHERE "id" = 1`;
  return Number(rows[0]?.version ?? 0);
}
