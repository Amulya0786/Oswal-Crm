import Link from "next/link";
import { getScope } from "@/server/auth";
import { getAnalytics } from "@/server/analytics";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const { user, scope } = await getScope();
  if (!user?.caps.analytics) return <p>Analytics is for supervisors.</p>;
  const data = await getAnalytics(user, scope);
  const maxHeat = Math.max(...data.heat.map((row) => row.tickets), 1);
  return (
    <div>
      <div className="page-head"><div><p className="kicker">Analytics</p><h1>How the desk is moving</h1></div></div>
      <div className="grid-2">
        <section className="panel">
          <h2>Inflow versus closures</h2>
          {data.trend.slice(-14).map((row) => (
            <div key={row.date} className="bar-row"><span>{row.date}</span><span className="bar-track"><span style={{ width: `${row.logged * 4}%`, maxWidth: "100%" }} /></span><b>{row.logged}/{row.closed}</b></div>
          ))}
        </section>
        <section className="panel">
          <h2>Technician leaderboard</h2>
          {data.leaders.map((row) => <p key={row.name}><b>{row.name}</b> · closed {row.closed} · live {row.live} · MTTR {row.mttr ?? "—"}h</p>)}
        </section>
      </div>
      <div className="grid-2" style={{ marginTop: 12 }}>
        <section className="panel"><h2>MTTR by product</h2>{data.mttrProduct.map((row) => <p key={row.label}>{row.label}: {row.mttr}h · {row.tickets}</p>)}</section>
        <section className="panel"><h2>MTTR by state</h2>{data.mttrState.map((row) => <p key={row.label}>{row.label}: {row.mttr}h</p>)}</section>
      </div>
      <section className="panel" style={{ marginTop: 12 }}>
        <h2>Top problems</h2>
        {data.problems.map((row) => <p key={row.label}>{row.label} · {row.tickets}</p>)}
      </section>
      <section className="panel" style={{ marginTop: 12 }}>
        <h2>Live complaints by district</h2>
        <div className="heat">
          {data.heat.map((row) => (
            <Link key={row.label} href={`/complaints?q=${encodeURIComponent(row.label)}&statusGroup=active`} style={{ background: `rgba(2,80,47,${0.15 + (row.tickets / maxHeat) * 0.85})` }}>
              <b>{row.label}</b><div>{row.tickets}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
