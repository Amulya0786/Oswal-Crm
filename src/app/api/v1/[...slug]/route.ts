import { prisma } from "@/server/db";
import { createComplaint, updateComplaint } from "@/server/complaints";
import { listComplaints } from "@/server/query";
import { filtersFromRecord } from "@/server/scope";
import { fail, json, readJson } from "@/server/http";
import { toSessionUser } from "@/server/auth";

async function serviceUser() {
  const key = process.env.OSWAL_API_KEY || "oswal-demo-key";
  const user = await prisma.user.findFirst({
    where: { role: "ADMIN", active: true },
    include: { memberships: { include: { company: true } }, states: true, districts: true, brands: true },
  });
  if (!user) return null;
  return { key, user: toSessionUser(user) };
}

async function authorized(req: Request) {
  const ctx = await serviceUser();
  if (!ctx) return null;
  if ((req.headers.get("x-api-key") ?? "") !== ctx.key) return null;
  return ctx.user;
}

export async function GET(req: Request, context: { params: Promise<{ slug: string[] }> }) {
  try {
    const user = await authorized(req);
    if (!user) return json({ error: "API key required" }, 401);
    const { slug } = await context.params;
    const url = new URL(req.url);
    const record = Object.fromEntries(url.searchParams.entries());
    if (slug[0] === "complaints" && !slug[1]) return json(await listComplaints(user, "all", filtersFromRecord(record)));
    if (slug[0] === "complaints" && slug[1]) {
      const row = await prisma.complaint.findUnique({ where: { ticketNo: slug[1].toUpperCase() } });
      return row ? json(row) : json({ error: "Not found" }, 404);
    }
    if (slug[0] === "customers") {
      const phone = url.searchParams.get("phone") ?? "";
      return json(await prisma.customer.findMany({ where: phone ? { phone: { contains: phone } } : {}, take: 25 }));
    }
    if (slug[0] === "products") return json(await prisma.product.findMany({ where: { active: true }, take: 200 }));
    return json({ error: "Not found" }, 404);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request, context: { params: Promise<{ slug: string[] }> }) {
  try {
    const user = await authorized(req);
    if (!user) return json({ error: "API key required" }, 401);
    const { slug } = await context.params;
    if (slug[0] === "complaints") {
      const created = await createComplaint(user, await readJson(req));
      return json({ ticketNo: created.ticketNo, id: created.id, status: created.status }, 201);
    }
    return json({ error: "Not found" }, 404);
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ slug: string[] }> }) {
  try {
    const user = await authorized(req);
    if (!user) return json({ error: "API key required" }, 401);
    const { slug } = await context.params;
    if (slug[0] === "complaints" && slug[1]) {
      const row = await prisma.complaint.findUnique({ where: { ticketNo: slug[1].toUpperCase() } });
      if (!row) return json({ error: "Not found" }, 404);
      const updated = await updateComplaint(user, "all", row.id, await readJson(req));
      return json({ ticketNo: updated?.ticketNo, status: updated?.status });
    }
    return json({ error: "Not found" }, 404);
  } catch (error) {
    return fail(error);
  }
}
