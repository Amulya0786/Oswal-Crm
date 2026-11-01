import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { MASTERS } from "@/server/masters/registry";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Masters" };

export default async function MastersPage() {
  const counts = await Promise.all(
    MASTERS.map(async (master) => {
      const delegate = (prisma as unknown as Record<string, { count: () => Promise<number> }>)[master.model];
      return [master.key, await delegate.count()] as const;
    }),
  );
  const countOf = new Map(counts);
  const groups = [...new Set(MASTERS.map((master) => master.group))];
  return (
    <div>
      <PageHeader title="Masters" subtitle="Geography, catalogue, service network and the lists the complaint desk uses. Every master can be edited or imported from Excel." />
      {groups.map((group) => (
        <section key={group} className="mb-6">
          <h2 className="mb-3 font-display text-lg font-semibold text-navy">{group}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {MASTERS.filter((master) => master.group === group).map((master) => (
              <Link key={master.key} href={`/masters/${master.key}`} className="card block p-4 hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display font-semibold text-navy">{master.label}</h3>
                  <span className="font-display text-xl tabular-nums">{(countOf.get(master.key) ?? 0).toLocaleString("en-IN")}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{master.blurb}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
