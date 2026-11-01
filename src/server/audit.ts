import { prisma } from "@/lib/prisma";

export async function audit(entry: { entity: string; entityId?: string | null; action: string; userId?: string | null; changes?: unknown }) {
  await prisma.auditLog.create({
    data: {
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      action: entry.action,
      userId: entry.userId ?? null,
      changes: entry.changes === undefined ? null : JSON.stringify(entry.changes),
    },
  });
}
