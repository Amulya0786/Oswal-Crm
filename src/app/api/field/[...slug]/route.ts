import { getScope, rejectTemporaryPassword } from "@/server/auth";
import { fail, json, readJson } from "@/server/http";
import { checkIn, earnings, fieldClose, issueCloseOtp, todayVisits } from "@/server/field";
import { respondToOffer } from "@/server/assignment";
import { updateComplaint } from "@/server/complaints";
import { prisma } from "@/server/db";

async function actor() {
  const { user } = await getScope();
  return user;
}

export async function GET(_req: Request, context: { params: Promise<{ slug: string[] }> }) {
  try {
    const user = await actor();
    if (!user) return json({ error: "Sign in" }, 401);
    rejectTemporaryPassword(user);
    const { slug } = await context.params;
    if (slug[0] === "today") return json({ visits: await todayVisits(user) });
    if (slug[0] === "earnings") return json(await earnings(user));
    if (slug[0] === "parts") return json({ parts: await prisma.sparePart.findMany({ where: { active: true }, orderBy: { name: "asc" }, take: 200 }) });
    return json({ error: "Not found" }, 404);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request, context: { params: Promise<{ slug: string[] }> }) {
  try {
    const user = await actor();
    if (!user) return json({ error: "Sign in" }, 401);
    rejectTemporaryPassword(user);
    const { slug } = await context.params;
    const body = await readJson(req);
    if (slug[0] === "serial" && user.engineerId) {
      await prisma.complaint.updateMany({ where: { id: String(body.complaintId), engineerId: user.engineerId }, data: { serialNo: String(body.serial ?? "").slice(0, 40) } });
      return json({ ok: true });
    }
    if (slug[0] === "respond") {
      if (!user.engineerId) return json({ error: "Technician login required" }, 403);
      return json(await respondToOffer(user.engineerId, String(body.complaintId), body.decision === "reject" ? "reject" : "accept", body.reason ? String(body.reason) : null));
    }
    if (slug[0] === "checkin") return json(await checkIn(user, String(body.complaintId), body.kind === "ARRIVE" ? "ARRIVE" : "START", body.lat, body.lng));
    if (slug[0] === "otp") return json(await issueCloseOtp(user, String(body.complaintId)));
    if (slug[0] === "close") return json(await fieldClose(user, String(body.complaintId), body));
    if (slug[0] === "hold") {
      const complaint = await prisma.complaint.findUnique({ where: { id: String(body.complaintId) } });
      if (!complaint) return json({ error: "Visit not found" }, 404);
      return json(await updateComplaint(user, complaint.companyId, complaint.id, { action: "hold", holdReason: body.reason }));
    }
    if (slug[0] === "ping") {
      if (!user.engineerId) return json({ error: "Technician login required" }, 403);
      await prisma.techPing.create({ data: { engineerId: user.engineerId, lat: Number(body.lat), lng: Number(body.lng) } });
      return json({ ok: true });
    }
    return json({ error: "Not found" }, 404);
  } catch (error) {
    return fail(error);
  }
}
