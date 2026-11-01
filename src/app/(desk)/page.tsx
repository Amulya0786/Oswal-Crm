import Link from "next/link";
import { getScope } from "@/server/auth";
import { getDashboard } from "@/server/query";
import { filtersFromRecord } from "@/server/scope";
import { formatNumber, formatWhen } from "@/lib/time";
import { labelOf, CALL_TYPES, STATUSES, statusClass } from "@/lib/labels";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, scope } = await getScope();
  if (!user) return null;
  const sp = await searchParams;
  const filters = filtersFromRecord(sp);
  const dimension = typeof sp.dimension === "string" ? sp.dimension : "state";
  const data = await getDashboard(user, scope, filters, dimension);
  const groups = ["pipeline", "type", "month", "today", "age", "sla"] as const;
  const titles: Record<string, string> = { pipeline: "Live pipeline", type: "By call type", month: "This month", today: "Today", age: "Ageing", sla: "Service level" };
  const company = scope === "all" ? "Oswal group" : user.companies.find((item) => item.id === scope)?.legalName;
  const max = Math.max(...data.drill.rows.map((row) => row.value), 1);
  const trendMax = Math.max(...data.trend.flatMap((row) => [row.logged, row.closed]), 1);
  return (
    <div>
      <div className="page-head">
        <div>
          <p className="kicker">{company}</p>
          <h1>Good day, {user.name.split(" ")[0]}</h1>
          <p>Every number opens the matching complaints. Counts stay on the server.</p>
        </div>
        {user.caps.book && <Link className="btn" href="/complaints/book">Book a complaint</Link>}
      </div>
      <form className="filters" method="get">
        <select name="dimension" defaultValue={dimension}>
          <option value="state">By state</option>
          <option value="district">By district</option>
          <option value="engineer">By technician</option>
          <option value="product">By product</option>
          <option value="type">By call type</option>
        </select>
        <input name="stateId" defaultValue={filters.stateId ?? ""} placeholder="State id filter" hidden />
        <button className="btn line" type="submit">Update chart</button>
        {(filters.stateId || filters.districtId || filters.callType) && <Link href="/">Clear drill</Link>}
      </form>
      {groups.map((group) => (
        <section key={group}>
          <div className="section-label">{titles[group]}</div>
          <div className={group === "type" ? "grid-5" : group === "pipeline" ? "grid-4" : "grid-4"}>
            {data.tiles.filter((tile) => tile.group === group).map((tile) => (
              <Link key={tile.key} href={tile.href} className={`tile tone-${tile.tone}`}>
                <span>{tile.label}</span>
                <b>{formatNumber(tile.value)}</b>
                <small>{tile.hint}</small>
              </Link>
            ))}
          </div>
        </section>
      ))}
      <div className="grid-2" style={{ marginTop: 16 }}>
        <section className="panel">
          <h2>Where the work sits</h2>
          {data.drill.rows.map((row) => (
            <Link key={row.label + row.href} href={row.href} className="bar-row">
              <span>{row.label}</span>
              <span className="bar-track"><span style={{ width: `${(row.value / max) * 100}%` }} /></span>
              <b>{formatNumber(row.value)}</b>
            </Link>
          ))}
          {!data.drill.rows.length && <p className="muted">No live complaints yet. Book a call and it will show up here.</p>}
        </section>
        <section className="panel">
          <h2>30 day inflow and closures</h2>
          {data.trend.every((row) => row.logged === 0 && row.closed === 0) ? (
            <p className="muted">No bookings in the last 30 days.</p>
          ) : (
            <svg className="trend" viewBox="0 0 300 120" role="img">
              <polyline fill="none" stroke="#c4621a" strokeWidth="2" points={data.trend.map((row, index) => `${index * 10},${110 - (row.logged / trendMax) * 100}`).join(" ")} />
              <polyline fill="none" stroke="#1b7a49" strokeWidth="2" points={data.trend.map((row, index) => `${index * 10},${110 - (row.closed / trendMax) * 100}`).join(" ")} />
            </svg>
          )}
          <p className="muted">Copper is booked. Green is closed.</p>
          <h2>Latest complaints</h2>
          {!data.recent.length && <p className="muted">Nothing booked yet.</p>}
          {data.recent.map((row) => (
            <Link key={row.id} href={`/complaints/${row.ticketNo}`} className="hit">
              <span className="mono">{row.ticketNo}</span> {row.customerName}
              <div className="muted">{row.companyName} · {row.districtName} · <span className={statusClass(row.status)}>{labelOf(STATUSES, row.status)}</span> · {labelOf(CALL_TYPES, row.callType)} · {formatWhen(row.bookDate)}</div>
            </Link>
          ))}
        </section>
      </div>
      {scope === "all" && (
        <div className="grid-2" style={{ marginTop: 12 }}>
          {data.companies.map((companyRow) => (
            <Link key={companyRow.id} href={`/complaints?companyId=${companyRow.id}&statusGroup=active`} className="tile">
              <span style={{ color: companyRow.accent }}>{companyRow.shortName}</span>
              <b>{formatNumber(companyRow.active)}</b>
              <small>Live complaints</small>
            </Link>
          ))}
        </div>
      )}
      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Serials still missing · {data.serialGap.total ? `${data.serialGap.percent}% (${data.serialGap.missing} of ${data.serialGap.total})` : "no complaints yet"}</h2>
        <p className="muted">{data.serialGap.total ? <a href="/reports/missing-serial">Open the missing-serial report</a> : "This share appears once complaints are booked."}</p>
        <div className="grid-2">
          <div>
            <h3>By state</h3>
            {data.serialGap.byState.map((row) => <p key={row.label}>{row.label}: {row.percent}% ({row.missing}/{row.total})</p>)}
          </div>
          <div>
            <h3>By technician</h3>
            {data.serialGap.byTechnician.map((row) => <p key={row.label}>{row.label}: {row.percent}%</p>)}
            <h3>By source</h3>
            {data.serialGap.bySource.map((row) => <p key={row.label}>{row.label}: {row.percent}%</p>)}
          </div>
        </div>
      </section>
      <p className="footer-note">Oswal Service · Phase 1 · counts refresh live without reloading the whole desk.</p>
    </div>
  );
}
