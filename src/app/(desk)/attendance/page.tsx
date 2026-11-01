import Link from "next/link";
import { getScope } from "@/server/auth";
import { prisma } from "@/server/db";
import { formatWhen } from "@/lib/time";
import { EmptyState } from "@/components/chrome";

export const metadata = { title: "Attendance" };

export default async function AttendancePage() {
  const { user, scope } = await getScope();
  if (!user) return null;
  const company = scope === "all" ? {} : { companyId: scope };
  const punches = await prisma.attendancePunch.findMany({
    where: { engineer: company },
    orderBy: { at: "desc" },
    take: 200,
    include: { engineer: { select: { name: true } } },
  });
  return (
    <div>
      <div className="page-head">
        <div>
          <p className="kicker">Service</p>
          <h1>Attendance</h1>
          <p>Punch in and punch out from the technician app, with the GPS point when the phone shared one.</p>
        </div>
        <Link className="btn" href="/field">Open the technician app</Link>
      </div>
      {!punches.length && <EmptyState title="No punches yet" body="When a technician punches in or out, the time and place show up here." />}
      {!!punches.length && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>When</th><th>Technician</th><th>Punch</th><th>Location</th></tr></thead>
            <tbody>
              {punches.map((row) => (
                <tr key={row.id}>
                  <td>{formatWhen(row.at)}</td>
                  <td>{row.engineer.name}</td>
                  <td>{row.kind === "IN" ? "In" : "Out"}</td>
                  <td>{row.lat != null && row.lng != null ? `${row.lat.toFixed(4)}, ${row.lng.toFixed(4)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
