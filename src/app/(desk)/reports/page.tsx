import Link from "next/link";
import { REPORTS } from "@/server/reports";

export const metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <div>
      <div className="page-head"><div><p className="kicker">Reports</p><h1>The numbers behind the desk</h1><p>Filter, then export. Row-level exports run in the background.</p></div></div>
      <div className="cards">
        {REPORTS.map((report) => (
          <Link key={report.slug} href={`/reports/${report.slug}`} className={`report-card ${report.slug.includes("count") ? "feature" : ""}`}>
            <b>{report.title}</b>
            <p>{report.blurb}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
