import { prisma } from "./db";
import { formatTicketNo, parseTicketNo } from "@/lib/ticket";
import { yyMMdd } from "@/lib/time";

export async function nextTicketNo(bookDate = new Date()) {
  const dateKey = yyMMdd(bookDate);
  const rows = await prisma.$queryRaw<{ lastSeq: number | bigint }[]>`
    INSERT INTO "TicketCounter" ("dateKey", "lastSeq")
    VALUES (${dateKey}, 1)
    ON CONFLICT ("dateKey")
    DO UPDATE SET "lastSeq" = "TicketCounter"."lastSeq" + 1
    RETURNING "lastSeq"
  `;
  return formatTicketNo(bookDate, Number(rows[0]?.lastSeq ?? 1));
}

export async function ensureCounterAtLeast(dateKey: string, seq: number) {
  if (!dateKey || !Number.isFinite(seq)) return;
  await prisma.$executeRaw`
    INSERT INTO "TicketCounter" ("dateKey", "lastSeq")
    VALUES (${dateKey}, ${seq})
    ON CONFLICT ("dateKey")
    DO UPDATE SET "lastSeq" = GREATEST("TicketCounter"."lastSeq", ${seq})
  `;
}

export async function rememberTicket(ticketNo: string) {
  const parsed = parseTicketNo(ticketNo);
  if (!parsed) return;
  await ensureCounterAtLeast(parsed.dateKey, parsed.seq);
}
