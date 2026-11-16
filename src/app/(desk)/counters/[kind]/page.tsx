import Link from "next/link";
import { notFound } from "next/navigation";
import { getScope } from "@/server/auth";
import { ticketCounters, type CounterRow } from "@/server/counters";
import { formatNumber } from "@/lib/time";

export const metadata = { title: "Ticket counter" };

function href(kind: "state" | "brand", row: CounterRow, extra: Record<string, string>) {
  const params = new URLSearchParams(extra);
  if (row.id) params.set(kind === "state" ? "stateId" : "brandId", row.id);
  return `/complaints?${params.toString()}`;
}

export default async function CounterPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (kind !== "state" && kind !== "brand") notFound();
  const { user, scope } = await getScope();
  if (!user) return null;
  const rows = await ticketCounters(user, scope, kind);
  const title = kind === "state" ? "State ticket counter" : "Brand ticket counter";
  return (
    <div>
      <div className="page-head">
        <h1>{title}</h1>
        <Link className="btn line" href={kind === "state" ? "/counters/brand" : "/counters/state"}>{kind === "state" ? "Brand counter" : "State counter"}</Link>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{kind === "state" ? "State" : "Brand"}</th>
              <th>0–7</th><th>8–15</th><th>16–30</th><th>30+</th>
              <th>Pending today</th><th>Closed today</th><th>Happy calling today</th><th>Total pending</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.id}-${row.label}`}>
                <td>{row.label}</td>
                <td className="num"><Link href={href(kind, row, { ageing: "0-7" })}>{formatNumber(Number(row.b07))}</Link></td>
                <td className="num"><Link href={href(kind, row, { ageing: "8-15" })}>{formatNumber(Number(row.b815))}</Link></td>
                <td className="num"><Link href={href(kind, row, { ageing: "16-30" })}>{formatNumber(Number(row.b1630))}</Link></td>
                <td className="num"><Link href={href(kind, row, { ageing: "30+" })}>{formatNumber(Number(row.b30))}</Link></td>
                <td className="num"><Link href={href(kind, row, { booked: "today", statusGroup: "active" })}>{formatNumber(Number(row.pendingToday))}</Link></td>
                <td className="num"><Link href={href(kind, row, { closed: "today" })}>{formatNumber(Number(row.closedToday))}</Link></td>
                <td className="num"><Link href={href(kind, row, { happy: "today" })}>{formatNumber(Number(row.happyToday))}</Link></td>
                <td className="num"><Link href={href(kind, row, { statusGroup: "active" })}>{formatNumber(Number(row.totalPending))}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p>No complaints in this view.</p>}
    </div>
  );
}
