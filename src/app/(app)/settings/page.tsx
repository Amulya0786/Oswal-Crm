import Link from "next/link";
import { SlaForm } from "@/components/settings-forms";
import { Forbidden, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/time";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/current-user";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  if (!can(user.role, "manageSla")) return <Forbidden />;
  const [policies, audits] = await Promise.all([
    prisma.slaPolicy.findMany({ orderBy: { complaintType: "asc" } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 12, include: { user: { select: { name: true } } } }),
  ]);
  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="Response and closing clocks per complaint type. The hourly job escalates a breach from technician to area manager, state head, then admin." actions={<Link href="/settings/notifications" className="btn btn-ghost">Notification templates</Link>} />
      <SlaForm policies={policies.map((policy) => ({ complaintType: policy.complaintType, responseHours: policy.responseHours, closeHours: policy.closeHours, escalationCooldownHours: policy.escalationCooldownHours }))} />
      <section className="card p-4">
        <h2 className="font-display text-lg font-semibold text-navy">Recent audit</h2>
        <ul className="mt-3 divide-y divide-line text-sm">
          {audits.map((row) => (
            <li key={row.id} className="py-2">
              <span className="font-medium text-navy">{row.action}</span> {row.entity} {row.entityId ?? ""}
              <span className="text-muted"> · {row.user?.name ?? "System"} · {formatDateTime(row.createdAt)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
