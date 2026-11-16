import Link from "next/link";
import { REPORTS } from "@/server/reports";

export const metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <div>
      <div className="page-head"><h1>Reports</h1></div>
      <div className="cards">
        <Link href="/reports/ageing" className="report-card feature">
          <b>Daily ageing</b>
          <p>State, partner and portal, in 0–7, 8–15, 16–30 and 30+ days. Excel and PDF.</p>
        </Link>
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
