import Link from "next/link";
import { TemplateEditor } from "@/components/settings-forms";
import { Forbidden, PageHeader } from "@/components/ui";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/current-user";

export const metadata = { title: "Notification templates" };

export default async function NotificationsPage() {
  const user = await requireUser();
  if (!can(user.role, "manageTemplates")) return <Forbidden />;
  const templates = await prisma.notificationTemplate.findMany({ orderBy: [{ event: "asc" }, { channel: "asc" }] });
  return (
    <div>
      <PageHeader title="Notification templates" subtitle="WhatsApp, SMS and email at booking, assignment, visit and closing. The closing message carries the feedback link. Providers stay on the console log until their environment variables are set." actions={<Link href="/settings" className="btn btn-ghost">SLA settings</Link>} />
      <TemplateEditor templates={templates} />
    </div>
  );
}
