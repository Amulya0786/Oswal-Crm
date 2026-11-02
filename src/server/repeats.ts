import { Prisma } from "@prisma/client";
import { prisma } from "./db";

const KEY = "repeatRebuild";
const BATCH = 400;

export type RepeatRow = {
  id: string;
  ticketNo: string;
  bookDate: Date;
  status: string;
  serialNorm: string | null;
  phone: string;
  productId: string | null;
};

type Prior = { ticketNo: string; bookDate: Date };

export type RepeatProgress = {
  status: "idle" | "running" | "done" | "error";
  processed: number;
  total: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
};

const CLOSED = new Set(["CLOSED", "HAPPY_CALLING"]);

/** Latest earlier closed ticket for the same serial, or the same mobile and product when there is no serial. */
export function applyRepeat(row: RepeatRow, serials: Map<string, Prior>, mobiles: Map<string, Prior>) {
  const serial = row.serialNorm?.trim() || null;
  const mobileKey = `${row.phone}|${row.productId ?? ""}`;
  const prior = serial ? serials.get(serial) : mobiles.get(mobileKey);
  const ticket = prior && prior.bookDate < row.bookDate ? prior.ticketNo : null;
  if (CLOSED.has(row.status)) {
    const next = { ticketNo: row.ticketNo, bookDate: row.bookDate };
    if (serial) serials.set(serial, next);
    else mobiles.set(mobileKey, next);
  }
  return { repeatOfTicket: ticket, repeatFlag: Boolean(ticket) };
}

let active = false;

async function save(progress: RepeatProgress) {
  await prisma.appSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(progress) },
    update: { value: JSON.stringify(progress) },
  });
}

export async function repeatProgress(): Promise<RepeatProgress> {
  const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
  if (!row) return { status: "idle", processed: 0, total: 0, startedAt: null, finishedAt: null, error: null };
  try {
    const parsed = JSON.parse(row.value) as RepeatProgress;
    if (parsed.status === "running" && !active) {
      return { ...parsed, status: "error", error: parsed.error ?? "The rebuild stopped before it finished. Start it again." };
    }
    return parsed;
  } catch {
    return { status: "idle", processed: 0, total: 0, startedAt: null, finishedAt: null, error: null };
  }
}

export async function startRepeatRebuild() {
  if (active) return repeatProgress();
  const total = await prisma.complaint.count();
  const progress: RepeatProgress = {
    status: "running",
    processed: 0,
    total,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
  };
  await save(progress);
  active = true;
  void runRepeatRebuild(total).catch(async (error: unknown) => {
    await save({
      status: "error",
      processed: 0,
      total,
      startedAt: progress.startedAt,
      finishedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Rebuild failed",
    });
  }).finally(() => {
    active = false;
  });
  return progress;
}

async function runRepeatRebuild(total: number) {
  const serials = new Map<string, Prior>();
  const mobiles = new Map<string, Prior>();
  let processed = 0;
  let cursor: { bookDate: Date; createdAt: Date; id: string } | null = null;
  const startedAt = new Date().toISOString();
  try {
  while (processed < total) {
    const rows: {
      id: string;
      ticketNo: string;
      bookDate: Date;
      status: string;
      serialNorm: string | null;
      phone: string;
      productId: string | null;
      createdAt: Date;
    }[] = await prisma.complaint.findMany({
      where: cursor
        ? {
            OR: [
              { bookDate: { gt: cursor.bookDate } },
              { bookDate: cursor.bookDate, createdAt: { gt: cursor.createdAt } },
              { bookDate: cursor.bookDate, createdAt: cursor.createdAt, id: { gt: cursor.id } },
            ],
          }
        : {},
      orderBy: [{ bookDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      take: BATCH,
      select: { id: true, ticketNo: true, bookDate: true, status: true, serialNorm: true, phone: true, productId: true, createdAt: true },
    });
    if (!rows.length) break;
    const linked = rows.map((row) => ({ id: row.id, ...applyRepeat(row, serials, mobiles) }));
    const values = Prisma.join(linked.map((row) => Prisma.sql`(${row.id}::text, ${row.repeatOfTicket}::text, ${row.repeatFlag}::boolean)`));
    await prisma.$executeRaw`
      UPDATE "Complaint" AS c
      SET "repeatOfTicket" = v.ticket, "repeatFlag" = v.flag
      FROM (VALUES ${values}) AS v(id, ticket, flag)
      WHERE c.id = v.id
    `;
    processed += rows.length;
    cursor = { bookDate: rows[rows.length - 1].bookDate, createdAt: rows[rows.length - 1].createdAt, id: rows[rows.length - 1].id };
    await save({ status: "running", processed, total, startedAt, finishedAt: null, error: null });
    await new Promise((resolve) => setImmediate(resolve));
  }
  await save({ status: "done", processed, total, startedAt, finishedAt: new Date().toISOString(), error: null });
  } catch (error) {
    await save({
      status: "error",
      processed,
      total,
      startedAt,
      finishedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Rebuild failed",
    });
  }
}
