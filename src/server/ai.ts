import { prisma } from "./db";
import { aiMode, breachRisk, parseQuestion, suggestBooking, suggestFixes, summariseTimeline } from "@/lib/phase3";

export function adapterMode() {
  return aiMode(process.env.AI_API_KEY);
}

export async function bookingHint(description: string, phone?: string | null) {
  const prior = phone
    ? await prisma.complaint.count({ where: { phone, status: { in: ["OPEN", "ASSIGNED", "REASSIGNED", "PENDING"] } } })
    : 0;
  const hint = suggestBooking(description, prior > 0);
  return { ...hint, mode: adapterMode() };
}

export async function fixHints(problem: string) {
  const rows = await prisma.complaint.findMany({
    where: { actualProblem: { not: null }, actualSolution: { not: null }, status: { in: ["CLOSED", "HAPPY_CALLING"] } },
    orderBy: { closedAt: "desc" },
    take: 40,
    select: { actualProblem: true, actualSolution: true },
  });
  const history = rows.flatMap((row) => row.actualProblem && row.actualSolution ? [{ problem: row.actualProblem, solution: row.actualSolution }] : []);
  return { steps: suggestFixes(problem, history), mode: adapterMode() };
}

export async function dailyAiSummary() {
  const [open, aged, breach] = await Promise.all([
    prisma.complaint.count({ where: { status: { in: ["OPEN", "ASSIGNED", "REASSIGNED", "PENDING"] }, excludeFromMis: false } }),
    prisma.complaint.count({ where: { status: { in: ["OPEN", "ASSIGNED", "REASSIGNED", "PENDING"] }, excludeFromMis: false, bookDate: { lt: new Date(Date.now() - 7 * 86400000) } } }),
    prisma.complaint.count({ where: { slaBreached: true, status: { in: ["OPEN", "ASSIGNED", "REASSIGNED", "PENDING"] }, excludeFromMis: false } }),
  ]);
  const text = open === 0
    ? "No open complaints. Nothing aged, no district hotspot, and no SLA risk to report."
    : `${open} open. ${aged} older than 7 days. ${breach} already past SLA. Ask for a district when you want a hotspot.`;
  return { text, mode: adapterMode(), open, aged, breach };
}

export async function askTickets(question: string) {
  const parsed = parseQuestion(question);
  const where: { status?: { in: string[] }; districtName?: { contains: string; mode: "insensitive" }; productDetails?: { contains: string; mode: "insensitive" }; bookDate?: { lt: Date }; excludeFromMis: boolean } = { excludeFromMis: false };
  if (parsed.pending) where.status = { in: ["OPEN", "ASSIGNED", "REASSIGNED", "PENDING"] };
  if (parsed.district) where.districtName = { contains: parsed.district, mode: "insensitive" };
  if (parsed.product) where.productDetails = { contains: parsed.product, mode: "insensitive" };
  if (parsed.days) where.bookDate = { lt: new Date(Date.now() - parsed.days * 86400000) };
  const rows = await prisma.complaint.findMany({
    where,
    orderBy: { bookDate: "asc" },
    take: 8,
    select: { ticketNo: true, status: true, districtName: true, productDetails: true, bookDate: true },
  });
  const answer = rows.length
    ? `${rows.length} match. First is ${rows[0].ticketNo} in ${rows[0].districtName ?? "an unknown district"}.`
    : "No tickets match that question yet.";
  return { parsed, rows, answer, mode: adapterMode() };
}

export async function summariseComplaint(complaintId: string) {
  const events = await prisma.complaintEvent.findMany({ where: { complaintId }, orderBy: { at: "asc" }, take: 40 });
  const text = summariseTimeline(events.map((event) => event.message));
  await prisma.complaint.update({ where: { id: complaintId }, data: { aiSummary: text } });
  return { text, mode: adapterMode() };
}

export function riskNote(ageHours: number, slaHours: number, repeat: boolean) {
  return { ...breachRisk({ ageHours, slaHours, repeat }), mode: adapterMode() };
}
