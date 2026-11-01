import { createWriteStream } from "fs";
import { mkdir, readFile } from "fs/promises";
import path from "path";
import { once } from "events";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { filterSql, scopeSql } from "./scope";
import { loadRiskContext } from "./query";
import type { ComplaintFilters, SessionUser } from "@/lib/types";
import { csvCell } from "@/lib/csv";
import { labelOf, STATUSES, CALL_TYPES } from "@/lib/labels";
import { formatDay } from "@/lib/time";
import { localFile, saveObject, spacesConfigured } from "./storage";

const HEADERS = ["Comp. No", "Book date", "Customer", "Mobile", "Address", "Area", "District", "State", "Pincode", "Call type", "Category", "Product", "Nature", "Schedule date", "Assigned to", "Status", "Saral Id", "OEM / brand", "Priority", "Call by", "Final status", "Scheme", "MSEDCL consumer", "Company", "Ageing"];

export async function enqueueExport(user: SessionUser, scope: string, filters: ComplaintFilters) {
  const job = await prisma.exportJob.create({
    data: {
      userId: user.id,
      kind: "complaints",
      params: JSON.stringify({ scope, filters, mask: user.role === "TECHNICIAN" }),
      status: "QUEUED",
    },
  });
  setImmediate(() => {
    void runExport(job.id).catch((error) => console.error(error));
  });
  return job;
}

export async function runExport(id: string) {
  const job = await prisma.exportJob.findUnique({ where: { id } });
  if (!job || job.status === "DONE") return;
  await prisma.exportJob.update({ where: { id }, data: { status: "RUNNING" } });
  try {
    const params = JSON.parse(job.params) as { scope: string; filters: ComplaintFilters; mask: boolean };
    const user = job.userId ? await prisma.user.findUnique({
      where: { id: job.userId },
      include: { memberships: { include: { company: true } }, states: true, districts: true, brands: true },
    }) : null;
    if (!user) throw new Error("User missing");
    const { toSessionUser } = await import("./auth");
    const session = toSessionUser(user);
    const ctx = await loadRiskContext();
    const where = Prisma.sql`${scopeSql(session, params.scope)} AND ${filterSql(params.filters, ctx)}`;
    const fileName = `complaints-${id.slice(-6)}.csv`;
    const key = `exports/${fileName}`;
    const filePath = localFile(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    const stream = createWriteStream(filePath);
    stream.write(`${HEADERS.join(",")}\n`);
    let cursorId: string | null = null;
    let count = 0;
    const companies = new Map((await prisma.company.findMany()).map((company) => [company.id, company.shortName]));
    for (;;) {
      const rows: Record<string, unknown>[] = await prisma.$queryRaw`
        SELECT "id", "ticketNo", "bookDate", "customerName", phone, address, "areaName", "districtName", "stateName", pincode,
               "callType", "categoryName", "productDetails", "natureText", "scheduleDate", "assignedName", status, "saralId",
               "brandName", priority, "callBy", "finalStatus", "schemeName", "msedclConsumerNo", "companyId", "closedAt"
        FROM "Complaint"
        WHERE ${where}
          ${cursorId ? Prisma.sql`AND id > ${cursorId}` : Prisma.empty}
        ORDER BY id
        LIMIT 1000
      `;
      if (!rows.length) break;
      for (const row of rows) {
        const book = new Date(String(row.bookDate));
        const end = row.closedAt ? new Date(String(row.closedAt)) : new Date();
        const age = Math.max(0, Math.floor((end.getTime() - book.getTime()) / 86400000));
        const phone = params.mask ? "masked" : String(row.phone ?? "");
        const line = [
          row.ticketNo, formatDay(book), row.customerName, phone, row.address, row.areaName, row.districtName, row.stateName, row.pincode,
          labelOf(CALL_TYPES, String(row.callType)), row.categoryName, row.productDetails, row.natureText,
          row.scheduleDate ? formatDay(new Date(String(row.scheduleDate))) : "", row.assignedName, labelOf(STATUSES, String(row.status)),
          row.saralId, row.brandName, row.priority, row.callBy, row.finalStatus, row.schemeName, row.msedclConsumerNo,
          companies.get(String(row.companyId)) ?? "", age,
        ].map(csvCell).join(",");
        stream.write(`${line}\n`);
        count++;
      }
      cursorId = String(rows[rows.length - 1].id);
      if (rows.length < 1000) break;
    }
    stream.end();
    await once(stream, "finish");
    if (spacesConfigured()) await saveObject(key, await readFile(filePath), "text/csv");
    await prisma.exportJob.update({ where: { id }, data: { status: "DONE", filePath: key, fileName, rowCount: count, finishedAt: new Date() } });
  } catch (error) {
    await prisma.exportJob.update({
      where: { id },
      data: { status: "FAILED", error: error instanceof Error ? error.message : "Export failed", finishedAt: new Date() },
    });
  }
}

