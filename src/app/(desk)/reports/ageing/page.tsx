import Link from "next/link";
import { getScope } from "@/server/auth";
import { loadAgeingReport } from "@/server/ageing-report";
import { portalLabel } from "@/lib/portal";
import { formatNumber } from "@/lib/time";

export const metadata = { title: "Daily ageing" };

export default async function AgeingReportPage() {
  const { user } = await getScope();
  if (!user?.caps.report && !user?.caps.analytics) return <p>Reports are not part of your desk.</p>;
  const report = await loadAgeingReport();
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Daily ageing</h1>
          <p className="muted">Open work by state, partner and portal. 30+ means older than 30 days.</p>
        </div>
        <div className="filters">
          <a className="btn" href="/api/desk/ageing-report?format=xlsx">Excel</a>
          <a className="btn line" href="/api/desk/ageing-report?format=pdf">PDF</a>
          <Link className="btn line" href="/reports">Reports</Link>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>State</th><th>Partner</th><th>Portal</th><th>0–7</th><th>8–15</th><th>16–30</th><th>30+</th><th>Total</th></tr></thead>
          <tbody>
            {report.matrix.map((row) => (
              <tr key={`${row.state}-${row.partner}-${row.portal}`}>
                <td>{row.state}</td>
                <td>{row.partner}</td>
                <td>{portalLabel(row.portal === "UNSET" ? null : row.portal)}</td>
                <td className="num">{formatNumber(Number(row.b07))}</td>
                <td className="num">{formatNumber(Number(row.b815))}</td>
                <td className="num">{formatNumber(Number(row.b1630))}</td>
                <td className="num">{formatNumber(Number(row.b30))}</td>
                <td className="num">{formatNumber(Number(row.total))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!report.matrix.length && <p>No open complaints.</p>}
      <h2>Older than 30 days</h2>
      <p className="muted">{report.older.length} shown. The Excel file has the same list.</p>
    </div>
  );
}
