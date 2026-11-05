import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { scopeSql } from "./scope";
import { scorecardRow } from "@/lib/phase2";
import { textPdf } from "@/lib/pdf";
import type { SessionUser } from "@/lib/types";
import ExcelJS from "exceljs";

const SELECT = Prisma.sql`
  COUNT(*)::int AS tickets,
  COUNT(*) FILTER (WHERE c.status IN ('CLOSED','HAPPY_CALLING'))::int AS closed,
  COUNT(*) FILTER (WHERE c.status IN ('CLOSED','HAPPY_CALLING') AND c."slaBreached" = false)::int AS within_sla,
  COUNT(*) FILTER (WHERE c."firstTimeFix" IS TRUE)::int AS first_time,
  COUNT(*) FILTER (WHERE c."firstTimeFix" IS NOT NULL)::int AS scored,
  COUNT(*) FILTER (WHERE c."repeatWindow" IS NOT NULL)::int AS repeats,
  COALESCE(SUM(c."happyRating") FILTER (WHERE c."happyRating" IS NOT NULL), 0)::int AS feedback,
  COUNT(*) FILTER (WHERE c."happyRating" IS NOT NULL)::int AS feedback_count,
  ROUND((AVG(EXTRACT(EPOCH FROM (c."closedAt" - c."bookDate")) / 3600) FILTER (WHERE c."closedAt" IS NOT NULL))::numeric, 1) AS tat_hours
`;

function shape(label: string, row: { tickets: number; closed: number; within_sla: number; first_time: number; scored: number; repeats: number; feedback: number; feedback_count: number; tat_hours: number | null }) {
  const metrics = scorecardRow({
    tickets: Number(row.tickets),
    closed: Number(row.closed),
    withinSla: Number(row.within_sla),
    firstTime: Number(row.first_time),
    scored: Number(row.scored),
    repeats: Number(row.repeats),
    feedback: Number(row.feedback),
    feedbackCount: Number(row.feedback_count),
    tatHours: row.tat_hours == null ? null : Number(row.tat_hours),
  });
  return { label, tickets: Number(row.tickets), closed: Number(row.closed), ...metrics };
}

export async function loadScorecards(user: SessionUser, scope: string) {
  const where = scopeSql(user, scope, "c");
  const [technicians, districts, states] = await Promise.all([
    prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT COALESCE(c."assignedName", 'Unassigned') AS label, ${SELECT}
      FROM "Complaint" c WHERE ${where}
      GROUP BY 1 ORDER BY closed DESC LIMIT 50`,
    prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT COALESCE(c."districtName", 'Unknown') AS label, ${SELECT}
      FROM "Complaint" c WHERE ${where}
      GROUP BY 1 ORDER BY tickets DESC LIMIT 50`,
    prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT COALESCE(c."stateName", 'Unknown') AS label, ${SELECT}
      FROM "Complaint" c WHERE ${where}
      GROUP BY 1 ORDER BY tickets DESC LIMIT 40`,
  ]);
  const map = (rows: Record<string, unknown>[]) => rows.map((row) => shape(String(row.label), row as never));
  return { technicians: map(technicians), districts: map(districts), states: map(states) };
}

export async function scorecardWorkbook(data: Awaited<ReturnType<typeof loadScorecards>>) {
  const book = new ExcelJS.Workbook();
  for (const [name, rows] of [["Technicians", data.technicians], ["Districts", data.districts], ["States", data.states]] as const) {
    const sheet = book.addWorksheet(name);
    sheet.addRow(["Name", "Tickets", "Closed", "Closure %", "TAT hours", "First-time fix %", "Repeat %", "Feedback"]);
    for (const row of rows) sheet.addRow([row.label, row.tickets, row.closed, row.closureRate, row.tatHours ?? "", row.firstTimeFix, row.repeatRate, row.feedback ?? ""]);
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}

export function scorecardPdf(data: Awaited<ReturnType<typeof loadScorecards>>) {
  const lines = ["Technician scorecard"];
  for (const row of data.technicians.slice(0, 20)) lines.push(`${row.label}: closed ${row.closed}, FTF ${row.firstTimeFix}%, repeat ${row.repeatRate}%`);
  if (data.technicians.length === 0) lines.push("No technician closures yet.");
  lines.push("District scorecard");
  for (const row of data.districts.slice(0, 15)) lines.push(`${row.label}: ${row.tickets} tickets, ${row.closed} closed`);
  if (data.districts.length === 0) lines.push("No district volume yet.");
  return textPdf("Oswal scorecards", lines);
}
