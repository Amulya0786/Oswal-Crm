import Link from "next/link";
import { getScope } from "@/server/auth";
import { homeSnapshot } from "@/server/home";
import { prisma } from "@/server/db";
import { formatNumber } from "@/lib/time";
import { ImportBanner } from "@/components/import-banner";
import { cookies } from "next/headers";
import { phrase } from "@/lib/desk-copy";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, scope } = await getScope();
  if (!user) return null;
  const sp = await searchParams;
  const requested = typeof sp.view === "string" ? sp.view : "";
  const stateName = typeof sp.state === "string" ? sp.state : "";
  const view = user.role === "CALL_CENTRE"
    ? "desk"
    : user.role === "OEM_PARTNER"
      ? "oem"
      : user.role === "STATE_HEAD" || (user.role === "ADMIN" && requested === "state")
        ? "state"
        : "director";
  const states = view === "state" && user.role === "ADMIN"
    ? await prisma.state.findMany({ orderBy: { name: "asc" }, select: { name: true } })
    : [];
  const data = await homeSnapshot(user, scope, view === "state" ? stateName || null : null);
  const lang = (await cookies()).get("oswal_lang")?.value === "hi" ? "hi" : "en";
  const t = (text: string) => phrase(lang, text);
  const max = Math.max(...data.places.map((row) => row.open), 1);
  const trendMax = Math.max(...data.trend.map((row) => row.booked), 1);
  return (
    <div>
      <ImportBanner />
      <div className="page-head">
        <div>
          <h1>{t(view === "desk" ? "Call centre" : view === "oem" ? "Brand desk" : view === "state" ? "State" : "All India")}</h1>
          <p className="muted">Updated {new Date(data.updatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false })}</p>
        </div>
        <div className="filters">
          {user.role === "ADMIN" && <Link className={view === "director" ? "btn" : "btn line"} href="/">All India</Link>}
          {user.role === "ADMIN" && <Link className={view === "state" ? "btn" : "btn line"} href="/?view=state">State</Link>}
          {user.caps.book && <Link className="btn" href="/complaints/book">Book</Link>}
        </div>
      </div>
      {view === "state" && user.role === "ADMIN" && (
        <form className="filters" method="get">
          <input type="hidden" name="view" value="state" />
          <select name="state" defaultValue={stateName}>
            <option value="">All states in this view</option>
            {states.map((state) => <option key={state.name} value={state.name}>{state.name}</option>)}
          </select>
          <button className="btn line">Show</button>
        </form>
      )}
      <div className="tile-grid">
        <Link className="tile" href="/complaints?booked=today"><span>Booked today</span><b>{formatNumber(data.kpi.booked)}</b></Link>
        <Link className="tile" href="/complaints?closed=today"><span>Closed today</span><b>{formatNumber(data.kpi.closed)}</b></Link>
        <Link className="tile" href="/complaints?statusGroup=active"><span>Pending</span><b>{formatNumber(data.kpi.pending)}</b></Link>
        {view !== "desk" && <Link className="tile" href="/complaints?breach=1"><span>Overdue</span><b>{formatNumber(data.kpi.overdue)}</b></Link>}
        {view !== "desk" && <Link className="tile" href="/complaints?statusGroup=active"><span>First contact overdue</span><b>{formatNumber(data.kpi.first_contact ?? 0)}</b></Link>}
        {view !== "desk" && <Link className="tile" href="/assign"><span>To assign</span><b>{formatNumber(data.unassigned ?? 0)}</b></Link>}
        {view !== "desk" && <Link className="tile" href="/complaints?booked=month"><span>This month</span><b>{formatNumber(data.monthBooked ?? 0)}</b></Link>}
        {view !== "desk" && <Link className="tile" href="/contracts"><span>AMC due</span><b>{formatNumber(data.amc ?? 0)}</b></Link>}
      </div>
      {view === "desk" && (
        <div className="grid-2" style={{ marginTop: 16 }}>
          <Queue title="Booked today" rows={data.todayBooked} />
          <Queue title="Pending" rows={data.followUps} />
          <Queue title="Happy calling" rows={data.happyQueue} />
        </div>
      )}
      {view !== "desk" && (
        <div className="grid-2" style={{ marginTop: 16 }}>
          <section className="panel">
            <h2>{view === "state" ? "Districts" : "States"}</h2>
            {data.places.map((row) => (
              <div key={row.label} className="bar-row">
                <span>{row.label}</span>
                <span className="bar-track"><span style={{ width: `${(row.open / max) * 100}%` }} /></span>
                <b>{formatNumber(row.open)}</b>
              </div>
            ))}
            {!data.places.length && <p>No open complaints.</p>}
          </section>
          <section className="panel">
            <h2>Ageing</h2>
            <table><tbody>{data.ageing.map((row) => <tr key={row.label}><td>{row.label}</td><td className="num">{formatNumber(row.n)}</td></tr>)}</tbody></table>
            {!data.ageing.length && <p>No open complaints.</p>}
            <h2>Repeat and ratings</h2>
            <p>Repeat open · {formatNumber(data.kpi.repeats)}</p>
            <p>Happy calling waiting · {formatNumber(data.kpi.happy)}</p>
            <p>Average rating · {data.kpi.rating || "—"}</p>
            <h2>Companies</h2>
            {data.companies.map((row) => <p key={row.label}>{row.label} · {formatNumber(row.n)} open</p>)}
          </section>
          <section className="panel">
            <h2>Technicians, 30 days</h2>
            {data.technicians.map((row) => <p key={row.label}>{row.label} · {formatNumber(row.n)} closed</p>)}
            {!data.technicians.length && <p>No closures in 30 days.</p>}
          </section>
          <section className="panel">
            <h2>Pending by call type</h2>
            <table><tbody>{(data.byCall ?? []).map((row) => <tr key={row.label}><td>{row.label}</td><td className="num">{formatNumber(row.n)}</td></tr>)}</tbody></table>
            <h2>Status</h2>
            <table><tbody>{(data.byStatus ?? []).map((row) => <tr key={row.label}><td>{row.label}</td><td className="num">{formatNumber(row.n)}</td></tr>)}</tbody></table>
            <h2>Latest open</h2>
            {(data.latest ?? []).map((row) => <p key={row.id}><Link href={`/complaints/${row.id}`}>{row.ticketNo}</Link> · {row.customerName} · {row.stateName}</p>)}
          </section>
          <section className="panel">
            <h2>30-day bookings</h2>
            {data.trend.map((row) => (
              <div key={String(row.day)} className="bar-row">
                <span>{new Date(row.day).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
                <span className="bar-track"><span style={{ width: `${(row.booked / trendMax) * 100}%` }} /></span>
                <b>{formatNumber(row.booked)}</b>
              </div>
            ))}
            {!data.trend.length && <p>No bookings in 30 days.</p>}
          </section>
        </div>
      )}
    </div>
  );
}

function Queue({ title, rows }: { title: string; rows: { id: string; ticketNo: string; customerName: string }[] }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {rows.map((row) => <p key={row.id}><Link href={`/complaints/${row.id}`}>{row.ticketNo}</Link> · {row.customerName}</p>)}
      {!rows.length && <p>None.</p>}
    </section>
  );
}
