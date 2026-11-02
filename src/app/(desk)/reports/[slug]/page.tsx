import Link from "next/link";
import { notFound } from "next/navigation";
import { getScope } from "@/server/auth";
import { runReport } from "@/server/reports";
import { filtersFromRecord } from "@/server/scope";
import { formatDay } from "@/lib/time";

export default async function ReportPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, scope } = await getScope();
  if (!user?.caps.report) return <p>You do not have reports.</p>;
  const { slug } = await params;
  const sp = await searchParams;
  const report = await runReport(slug, user, scope, filtersFromRecord(sp));
  if (!report) notFound();
  const pages = Math.max(1, Math.ceil(report.total / Math.max(1, report.pageSize)));
  return (
    <div>
      <div className="page-head"><div><p className="kicker">Report</p><h1>{report.title}</h1><p>{report.blurb} · {report.total} rows</p></div><div className="filters">{user.caps.security && <a className="btn" href={`/api/desk/report-export?slug=${slug}`}>Excel</a>}<Link className="btn line" href="/reports">All reports</Link></div></div>
      <form className="filters">
        <label className="stack">From<input name="from" placeholder="dd/mm/yyyy" defaultValue={typeof sp.from === "string" ? sp.from : ""} /></label>
        <label className="stack">To<input name="to" placeholder="dd/mm/yyyy" defaultValue={typeof sp.to === "string" ? sp.to : ""} /></label>
        <button className="btn">Filter</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead><tr>{report.columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
          <tbody>
            {report.rows.map((row, index) => {
              const cells = row as Record<string, string | number>;
              return (
                <tr key={index}>{report.columns.map((column) => {
                  const value = String(cells[column.key] ?? "");
                  return <td key={column.key} data-label={column.label}>{value.includes("T") && value.length > 16 ? formatDay(value) : value}</td>;
                })}</tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {report.kind === "rows" && (
        <div className="pager">
          {report.page > 1 && <Link href={`?page=${report.page - 1}`}>Previous</Link>}
          <span>{report.page} / {pages}</span>
          {report.page < pages && <Link href={`?page=${report.page + 1}`}>Next</Link>}
        </div>
      )}
    </div>
  );
}
