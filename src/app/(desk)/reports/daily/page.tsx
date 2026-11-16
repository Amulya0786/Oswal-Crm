import { getScope } from "@/server/auth";
import { prisma } from "@/server/db";
import { ACTIVE_STATUSES } from "@/lib/labels";
import { dailyAiSummary } from "@/server/ai";

export const metadata = { title: "Daily summary" };

export default async function DailySummaryPage() {
  const { user, scope } = await getScope();
  if (!user?.caps.report) return <p>The daily summary is for supervisors.</p>;
  const company = scope === "all" ? {} : { companyId: scope };
  const [logged, closed, pending, breach, repeats] = await Promise.all([
    prisma.complaint.count({ where: { ...company, excludeFromMis: false } }),
    prisma.complaint.count({ where: { ...company, excludeFromMis: false, status: { in: ["CLOSED", "HAPPY_CALLING"] } } }),
    prisma.complaint.count({ where: { ...company, excludeFromMis: false, status: { in: [...ACTIVE_STATUSES] } } }),
    prisma.complaint.count({ where: { ...company, excludeFromMis: false, slaBreached: true, status: { in: [...ACTIVE_STATUSES] } } }),
    prisma.complaint.count({ where: { ...company, excludeFromMis: false, repeatWindow: { not: null } } }),
  ]);
  const note = await dailyAiSummary();
  const saved = await prisma.appSetting.findUnique({ where: { key: "lastSummary" } });
  const last = saved ? JSON.parse(saved.value) as { at?: string } : null;
  const rows = [
    ["Logged", logged],
    ["Closed", closed],
    ["Pending", pending],
    ["SLA breaches", breach],
    ["Repeat failures", repeats],
    ["Top districts", "None yet"],
    ["Technicians", "None yet"],
  ] as const;
  return (
    <div>
      <div className="page-head">
        <div>
          <p className="kicker">Reports</p>
          <h1>Daily summary</h1>
          <p>Managers receive this by email{process.env.SUMMARY_WHATSAPP ? " and WhatsApp" : ""}. Last send: {last?.at ?? "not yet"}.</p>
        </div>
      </div>
      <section className="panel">
        <h2>Preview</h2>
        <div className="tile-grid">
          {rows.slice(0, 5).map(([label, value]) => (
            <div key={label} className="tile">
              <span>{label}</span>
              <b>{value}</b>
            </div>
          ))}
        </div>
        <p>Top districts: none yet.</p>
        <p>Technicians: none yet.</p>
        <h2>Assistant note</h2>
        <p>{note.text}</p>
      </section>
    </div>
  );
}
