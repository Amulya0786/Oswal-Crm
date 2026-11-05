import { prisma } from "@/server/db";

export async function GET() {
  try {
    const rows = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
    return Response.json({ ok: rows[0]?.ok === 1, db: true, service: "oswal-service" });
  } catch (error) {
    const { reportError } = await import("@/server/monitor");
    await reportError(error, "health");
    return Response.json({ ok: false, db: false, service: "oswal-service" }, { status: 503 });
  }
}
