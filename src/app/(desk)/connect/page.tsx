"use client";

import { useEffect, useState } from "react";

type KeyRow = { id: string; name: string; prefix: string; createdAt: string; revokedAt: string | null };

export default function ConnectPage() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [fresh, setFresh] = useState("");
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
    void fetch("/api/desk/report-keys").then(async (response) => {
      if (response.ok) setKeys((await response.json()).keys ?? []);
    });
  }, []);
  const sample = fresh || "YOUR_KEY";
  const ticketUrl = `${origin}/api/report/tickets?key=${sample}&from=2026-04-01`;
  const odataUrl = `${origin}/api/report/odata?key=${sample}`;
  return (
    <div>
      <div className="page-head">
        <div>
          <p className="kicker">Admin</p>
          <h1>Connect Power BI / Excel</h1>
        </div>
      </div>
      <section className="panel stack">
        <h2>New key</h2>
        <form className="filters" onSubmit={async (event) => {
          event.preventDefault();
          const name = String(new FormData(event.currentTarget).get("name") ?? "");
          const response = await fetch("/api/desk/report-keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
          const body = await response.json();
          if (response.ok) { setFresh(body.key); setKeys((current) => [body.row, ...current]); }
        }}>
          <input name="name" placeholder="Key name" required />
          <button className="btn">Create key</button>
        </form>
        {fresh && <div className="banner">Copy this key now. It is not shown again. <span className="mono">{fresh}</span></div>}
        {keys.map((row) => (
          <p key={row.id}>{row.name} · {row.prefix}… {row.revokedAt ? "revoked" : <button className="btn line" onClick={async () => { await fetch("/api/desk/report-keys", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id }) }); setKeys((current) => current.map((item) => item.id === row.id ? { ...item, revokedAt: new Date().toISOString() } : item)); }}>Revoke</button>}</p>
        ))}
      </section>
      <section className="panel stack" style={{ marginTop: 12 }}>
        <h2>Excel</h2>
        <p>Data → From Web, then paste:</p>
        <p className="mono">{ticketUrl}</p>
        <h2>Power BI</h2>
        <p>Get data → OData feed or Web, then paste:</p>
        <p className="mono">{odataUrl}</p>
        <p>Other feeds: tickets, technicians, sla, ratings, scores, attendance. The same key works as the header x-report-key.</p>
      </section>
    </div>
  );
}
