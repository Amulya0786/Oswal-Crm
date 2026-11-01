import { prisma } from "@/server/db";
import { reportKeyAccepted } from "@/lib/report-key";
import { performanceScore, incentiveFor } from "@/lib/phase3";

function presentedKey(req: Request) {
  const url = new URL(req.url);
  return req.headers.get("x-report-key") || url.searchParams.get("key") || "";
}

async function authorize(req: Request) {
  const presented = presentedKey(req);
  if (!presented) return false;
  const keys = await prisma.reportKey.findMany({ where: { revokedAt: null }, select: { keyHash: true } });
  return reportKeyAccepted(presented, keys.map((row) => row.keyHash));
}

function windowOf(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  return {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lt: new Date(to) } : {}),
  };
}

function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "empty\n";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((key) => {
      const value = row[key];
      const text = value == null ? "" : String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }).join(","));
  }
  return lines.join("\n");
}

export async function GET(req: Request, context: { params: Promise<{ feed: string }> }) {
  if (!(await authorize(req))) return Response.json({ error: "Reporting key required" }, { status: 401 });
  const { feed } = await context.params;
  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "csv" || feed.endsWith(".csv") ? "csv" : "json";
  const name = feed.replace(/\.csv$/, "");
  const dates = windowOf(req);
  const bookDate = Object.keys(dates).length ? dates : undefined;
  let rows: Record<string, unknown>[] = [];
  if (name === "tickets" || name === "odata") {
    const data = await prisma.complaint.findMany({
      where: { excludeFromMis: false, ...(bookDate ? { bookDate } : {}) },
      orderBy: { bookDate: "desc" },
      take: 5000,
      select: {
        ticketNo: true, bookDate: true, status: true, callType: true, customerName: true, districtName: true, stateName: true,
        assignedName: true, productDetails: true, priority: true, slaDueAt: true, slaBreached: true, happyRating: true, closedAt: true, companyId: true,
      },
    });
    rows = data.map((row) => ({ ...row, bookDate: row.bookDate.toISOString(), slaDueAt: row.slaDueAt?.toISOString() ?? "", closedAt: row.closedAt?.toISOString() ?? "" }));
  } else if (name === "technicians") {
    const data = await prisma.engineer.findMany({ where: { active: true }, select: { name: true, phone: true, kind: true, employeeCode: true, companyId: true } });
    rows = data;
  } else if (name === "ratings") {
    const data = await prisma.complaint.findMany({
      where: { happyRating: { not: null }, excludeFromMis: false, ...(bookDate ? { happyAt: bookDate } : {}) },
      take: 5000,
      select: { ticketNo: true, assignedName: true, happyRating: true, happyRemarks: true, happyAt: true },
    });
    rows = data.map((row) => ({ ...row, happyAt: row.happyAt?.toISOString() ?? "" }));
  } else if (name === "attendance") {
    const data = await prisma.attendancePunch.findMany({
      where: bookDate ? { at: bookDate } : {},
      orderBy: { at: "desc" },
      take: 5000,
      include: { engineer: { select: { name: true } } },
    });
    rows = data.map((row) => ({ at: row.at.toISOString(), technician: row.engineer.name, kind: row.kind, lat: row.lat, lng: row.lng }));
  } else if (name === "scores") {
    const engineers = await prisma.engineer.findMany({ where: { active: true }, take: 200 });
    rows = [];
    for (const engineer of engineers) {
      const closures = await prisma.complaint.count({ where: { engineerId: engineer.id, status: { in: ["CLOSED", "HAPPY_CALLING"] } } });
      const assigned = await prisma.complaint.count({ where: { engineerId: engineer.id } });
      const scored = performanceScore({ closures, assigned, tatHours: null, slaHours: 48, repeats: 0, feedback: null, proofOk: closures, closed: closures, reopened: 0 });
      rows.push({ technician: engineer.name, closures, score: scored.score, incentive: incentiveFor(scored.score) });
    }
  } else if (name === "sla") {
    const data = await prisma.complaint.findMany({
      where: { excludeFromMis: false, status: { in: ["OPEN", "ASSIGNED", "REASSIGNED", "PENDING"] } },
      take: 5000,
      select: { ticketNo: true, status: true, slaDueAt: true, slaBreached: true, slaRisk: true, districtName: true, assignedName: true },
    });
    rows = data.map((row) => ({ ...row, slaDueAt: row.slaDueAt?.toISOString() ?? "" }));
  } else {
    return Response.json({ error: "Unknown feed" }, { status: 404 });
  }
  if (format === "csv") return new Response(csv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8" } });
  return Response.json({ "@odata.context": `${url.origin}/api/report/$metadata`, value: rows });
}
