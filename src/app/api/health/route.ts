import { prisma } from "@/server/db";

export async function GET() {
  const rows = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
  return Response.json({ ok: rows[0]?.ok === 1, service: "oswal-service" });
}
