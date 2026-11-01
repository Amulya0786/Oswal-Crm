import Link from "next/link";
import { cookies } from "next/headers";
import { getScope } from "@/server/auth";
import { getDashboard } from "@/server/query";
import { getAnalytics } from "@/server/analytics";
import { filtersFromRecord } from "@/server/scope";
import { formatNumber, formatWhen } from "@/lib/time";
import { labelOf, CALL_TYPES, STATUSES, statusClass } from "@/lib/labels";
import { DESK_LABEL, TILE_LABEL, type FieldLang } from "@/lib/i18n";
import { EmptyState, TileGrid } from "@/components/chrome";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, scope } = await getScope();
  if (!user) return null;
  const lang: FieldLang = (await cookies()).get("oswal_lang")?.value === "hi" ? "hi" : "en";
  const t = (key: string) => DESK_LABEL[lang][key] ?? key;
  const sp = await searchParams;
  const filters = filtersFromRecord(sp);
  const dimension = typeof sp.dimension === "string" ? sp.dimension : "state";
  const data = await getDashboard(user, scope, filters, dimension);
  const byKey = (key: string) => data.tiles.find((tile) => tile.key === key);
  const closedMonth = byKey("closed_month");
  const sections = [
    { id: "today", title: t("Today"), tiles: data.tiles.filter((tile) => tile.group === "today") },
    { id: "feedback", title: t("Ratings"), tiles: data.tiles.filter((tile) => tile.group === "feedback") },
    { id: "pipeline", title: t("Status pipeline"), tiles: ["open", "assigned", "pending"].map((key) => byKey(key)).concat(closedMonth ? [{ ...closedMonth, label: TILE_LABEL[lang].closed_month ?? "Closed this month", hint: lang === "hi" ? "इस महीने बंद" : "Closed this month" }] : []).concat(data.tiles.filter((tile) => tile.group === "pipeline" && !["open", "assigned", "pending"].includes(tile.key))).filter((tile): tile is NonNullable<typeof tile> => Boolean(tile)) },
    { id: "sla", title: t("SLA and ageing"), tiles: data.tiles.filter((tile) => tile.group === "age" || tile.group === "sla") },
    { id: "type", title: t("By call type"), tiles: data.tiles.filter((tile) => tile.group === "type") },
    { id: "month", title: t("This month"), tiles: data.tiles.filter((tile) => tile.group === "month" && tile.key !== "closed_month") },
  ].map((section) => ({
    ...section,
    tiles: section.tiles.map((tile) => ({ ...tile, label: TILE_LABEL[lang][tile.key] ?? tile.label })),
  }));
  const movement = user.caps.analytics || user.caps.report ? await getAnalytics(user, scope) : null;
  const hasMovement = Boolean(movement && (movement.leaders.length || movement.heat.length || movement.problems.length || movement.trend.some((row) => row.logged || row.closed)));
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
        {user.caps.book && <Link className="btn" href="/complaints/book">{t("Book a complaint")}</Link>}
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
      {sections.map((section) => (
        <section key={section.id}>
          <div className="section-label">{section.title}</div>
          <TileGrid tiles={section.tiles} />
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
          {!data.drill.rows.length && <EmptyState title="No live complaints" body="Book a call and the district, technician and product bars will fill in here." />}
        </section>
        <section className="panel">
          <h2>30 day inflow and closures</h2>
          {data.trend.every((row) => row.logged === 0 && row.closed === 0) ? (
            <EmptyState title="Quiet month" body="No bookings in the last 30 days." />
          ) : (
            <svg className="trend" viewBox="0 0 300 120" role="img">
              <polyline fill="none" stroke="#ffce30" strokeWidth="2" points={data.trend.map((row, index) => `${index * 10},${110 - (row.logged / trendMax) * 100}`).join(" ")} />
              <polyline fill="none" stroke="#02502f" strokeWidth="2" points={data.trend.map((row, index) => `${index * 10},${110 - (row.closed / trendMax) * 100}`).join(" ")} />
            </svg>
          )}
          <p className="muted">Gold is booked. Green is closed.</p>
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
        <section>
          <div className="section-label">{t("Company split")}</div>
          <TileGrid tiles={data.companies.map((companyRow) => ({ key: companyRow.id, href: `/complaints?companyId=${companyRow.id}&statusGroup=active`, tone: companyRow.shortName.includes("Solar") ? "copper" : "navy", label: companyRow.shortName, value: companyRow.active, hint: "Live complaints" }))} />
        </section>
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
      <details className="panel" style={{ marginTop: 16 }}>
        <summary>{lang === "hi" ? "गति — जिले, उत्पाद और तकनीशियन" : "Movement — districts, products and technicians"}</summary>
        {!hasMovement && <p className="muted">Nothing to chart yet. This used to be a separate Analytics page.</p>}
        {hasMovement && movement && (
          <div className="grid-2" style={{ marginTop: 12 }}>
            <div>
              <h2>Technicians</h2>
              {movement.leaders.map((row) => <p key={row.name}><b>{row.name}</b> · closed {row.closed} · live {row.live}</p>)}
            </div>
            <div>
              <h2>Live by district</h2>
              {movement.heat.map((row) => <p key={row.label}>{row.label}: {row.tickets}</p>)}
              <h2>Top problems</h2>
              {movement.problems.map((row) => <p key={row.label}>{row.label}: {row.tickets}</p>)}
            </div>
          </div>
        )}
      </details>
      <p className="footer-note">Oswal Service · counts refresh live without reloading the whole desk.</p>
    </div>
  );
}
