import Link from "next/link";
import { getScope } from "@/server/auth";
import { loadScorecards } from "@/server/scorecard";
import { EmptyState } from "@/components/chrome";

export const metadata = { title: "Scorecards" };

function Table({ title, rows }: { title: string; rows: { label: string; tickets: number; closed: number; closureRate: number; tatHours: number | null; firstTimeFix: number; repeatRate: number; feedback: number | null }[] }) {
  return (
    <section className="panel" style={{ marginTop: 12 }}>
      <h2>{title}</h2>
      {!rows.length && <p className="muted">No rows yet.</p>}
      {!!rows.length && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th className="num">Tickets</th><th className="num">Closed</th><th className="num">Closure %</th><th className="num">TAT h</th><th className="num">First-time fix %</th><th className="num">Repeat %</th><th className="num">Feedback</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td className="num">{row.tickets}</td>
                  <td className="num">{row.closed}</td>
                  <td className="num">{row.closureRate}</td>
                  <td className="num">{row.tatHours ?? "—"}</td>
                  <td className="num">{row.firstTimeFix}</td>
                  <td className="num">{row.repeatRate}</td>
                  <td className="num">{row.feedback ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function ScorecardsPage() {
  const { user, scope } = await getScope();
  if (!user?.caps.report) return <p>Scorecards are for supervisors.</p>;
  const data = await loadScorecards(user, scope);
  const empty = !data.technicians.length && !data.districts.length;
  return (
    <div>
      <div className="page-head">
        <div>
          <p className="kicker">Reports</p>
          <h1>Scorecards</h1>
          <p>Closures, turnaround, first-time fix, repeat rate and feedback.</p>
        </div>
        <span className="row-actions">
          <Link className="btn line" href="/api/desk/scorecards?format=xlsx">Excel</Link>
          <Link className="btn line" href="/api/desk/scorecards?format=pdf">PDF</Link>
        </span>
      </div>
      {empty && <EmptyState title="No scorecard rows yet" body="Technicians, districts and states appear here after complaints are booked and closed." />}
      <Table title="Technicians" rows={data.technicians} />
      <Table title="Districts" rows={data.districts} />
      <Table title="States" rows={data.states} />
    </div>
  );
}
