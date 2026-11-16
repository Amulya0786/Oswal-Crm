import { Prisma } from "@prisma/client";
import { ARCHIVE_STATUSES, archiveCutoff } from "@/lib/archive";
import { prisma } from "./db";

/** Mark tickets closed more than 12 months ago. Rows stay in Complaint so a ticket can still be opened. */
export async function archiveClosedTickets(now = new Date()) {
  const cutoff = archiveCutoff(now);
  const moved = await prisma.$executeRaw`
    UPDATE "Complaint"
    SET "archived" = true, "archivedAt" = ${now}
    WHERE "archived" = false
      AND status IN (${Prisma.join([...ARCHIVE_STATUSES])})
      AND COALESCE("closedAt", "cancelledAt") < ${cutoff}
  `;
  return { archived: Number(moved), cutoff: cutoff.toISOString() };
}
