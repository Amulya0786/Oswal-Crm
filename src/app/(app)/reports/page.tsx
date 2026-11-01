import Link from "next/link";
import { Forbidden, PageHeader } from "@/components/ui";
import { can } from "@/lib/rbac";
import { requireUser } from "@/server/current-user";
import { REPORTS } from "@/server/reports";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const user = await requireUser();
  if (!can(user.role, "viewReports")) return <Forbidden />;
  return (
    <div>
      <PageHeader title="Reports" subtitle="The Smartlogics report set, with filters and an Excel download on each report." />
      <div className="grid gap-3 sm:grid-cols-2">
        {REPORTS.map((report) => (
          <Link key={report.slug} href={`/reports/${report.slug}`} className="card block p-4 hover:-translate-y-0.5 hover:shadow-lg">
            <h2 className="font-display font-semibold text-navy">{report.title}</h2>
            <p className="mt-1 text-sm text-muted">{report.blurb}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
