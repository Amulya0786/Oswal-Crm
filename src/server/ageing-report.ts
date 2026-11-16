import { Prisma } from "@prisma/client";
import ExcelJS from "exceljs";
import { prisma } from "./db";
import { ageBucket, formatDay, midnightShift } from "@/lib/time";
import { portalLabel } from "@/lib/portal";
import { textPdf } from "@/lib/pdf";

export type AgeingMatrixRow = {
  state: string;
  partner: string;
  portal: string;
  b07: number;
  b815: number;
  b1630: number;
  b30: number;
  total: number;
};

export type AgeingOldRow = {
  ticketNo: string;
  customerName: string;
  stateName: string | null;
  partner: string;
  portal: string | null;
  portalNo: string | null;
  status: string;
  bookDate: Date;
};

export async function loadAgeingReport(now = new Date()) {
  const start7 = midnightShift(now, -7);
  const start15 = midnightShift(now, -15);
  const start30 = midnightShift(now, -30);
  const tomorrow = midnightShift(now, 1);
  const live = Prisma.sql`c.status NOT IN ('CLOSED', 'HAPPY_CALLING', 'CANCELLED') AND c."excludeFromMis" = false`;
  const matrix = await prisma.$queryRaw<AgeingMatrixRow[]>`
    SELECT COALESCE(NULLIF(c."stateName", ''), 'Unknown') AS state,
      COALESCE(co."shortName", 'Unknown') AS partner,
      COALESCE(c.portal, 'UNSET') AS portal,
      COUNT(*) FILTER (WHERE c."bookDate" >= ${start7} AND c."bookDate" < ${tomorrow})::int AS b07,
      COUNT(*) FILTER (WHERE c."bookDate" >= ${start15} AND c."bookDate" < ${start7})::int AS b815,
      COUNT(*) FILTER (WHERE c."bookDate" >= ${start30} AND c."bookDate" < ${start15})::int AS b1630,
      COUNT(*) FILTER (WHERE c."bookDate" < ${start30})::int AS b30,
      COUNT(*)::int AS total
    FROM "Complaint" c
    LEFT JOIN "Company" co ON co.id = c."companyId"
    WHERE ${live}
    GROUP BY 1, 2, 3
    ORDER BY 1, 2, 3
  `;
  const older = await prisma.$queryRaw<AgeingOldRow[]>`
    SELECT c."ticketNo", c."customerName", c."stateName", COALESCE(co."shortName", 'Unknown') AS partner,
      c.portal, c."portalNo", c.status, c."bookDate"
    FROM "Complaint" c
    LEFT JOIN "Company" co ON co.id = c."companyId"
    WHERE ${live} AND c."bookDate" < ${start30}
    ORDER BY c."bookDate" ASC
    LIMIT 500
  `;
  return { now, matrix, older };
}

export async function ageingWorkbook(report: Awaited<ReturnType<typeof loadAgeingReport>>) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Ageing");
  sheet.addRow(["State", "Partner", "Portal", "0–7 days", "8–15 days", "16–30 days", "30+ days", "Total"]);
  for (const row of report.matrix) {
    sheet.addRow([row.state, row.partner, portalLabel(row.portal === "UNSET" ? null : row.portal), Number(row.b07), Number(row.b815), Number(row.b1630), Number(row.b30), Number(row.total)]);
  }
  const old = book.addWorksheet("30+ days");
  old.addRow(["Complaint", "Customer", "State", "Partner", "Portal", "Portal no", "Status", "Booked", "Bucket"]);
  for (const row of report.older) {
    old.addRow([row.ticketNo, row.customerName, row.stateName ?? "", row.partner, portalLabel(row.portal), row.portalNo ?? "", row.status, formatDay(row.bookDate), ageBucket(new Date(row.bookDate), report.now)]);
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}

export function ageingPdf(report: Awaited<ReturnType<typeof loadAgeingReport>>) {
  const lines = [`Ageing on ${formatDay(report.now)}`, "State · partner · portal · 0–7 · 8–15 · 16–30 · 30+ · total"];
  for (const row of report.matrix.slice(0, 24)) {
    lines.push(`${row.state} · ${row.partner} · ${portalLabel(row.portal === "UNSET" ? null : row.portal)} · ${row.b07} · ${row.b815} · ${row.b1630} · ${row.b30} · ${row.total}`);
  }
  if (report.matrix.length > 24) lines.push(`${report.matrix.length - 24} more rows are in the Excel file.`);
  lines.push("Older than 30 days");
  for (const row of report.older.slice(0, 12)) {
    lines.push(`${row.ticketNo} · ${row.stateName ?? "Unknown"} · ${portalLabel(row.portal)} · ${ageBucket(new Date(row.bookDate), report.now)}`);
  }
  if (report.older.length > 12) lines.push(`${report.older.length - 12} more old tickets are in the Excel file.`);
  return textPdf("Oswal ageing", lines);
}
