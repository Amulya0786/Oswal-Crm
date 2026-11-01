"use client";

import { useState } from "react";

export default function CallsPage() {
  const [phone, setPhone] = useState("");
  const [pop, setPop] = useState<{ ticketNo?: string | null; customerName?: string | null; status?: string | null; phone?: string } | null>(null);
  const [error, setError] = useState("");
  return (
    <div>
      <div className="page-head">
        <div>
          <p className="kicker">Telephony</p>
          <h1>Screen pop</h1>
          <p>No phone provider is connected. A caller mobile still opens the latest complaint and writes a call on its timeline.</p>
        </div>
      </div>
      <form className="panel stack" onSubmit={async (event) => {
        event.preventDefault();
        const response = await fetch("/api/desk/calls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, note: "Screen pop" }) });
        const body = await response.json();
        if (!response.ok) setError(body.error ?? "Could not look up");
        else { setPop(body); setError(""); }
      }}>
        <label className="stack">Caller mobile<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="10-digit mobile" required /></label>
        <button className="btn">Look up</button>
        {error && <div className="banner bad">{error}</div>}
        {pop && (
          <p>{pop.ticketNo ? <>Open <b className="mono">{pop.ticketNo}</b> · {pop.customerName} · {pop.status}</> : "No complaint for this mobile yet. The lookup was still logged."}</p>
        )}
        {!pop && <p className="muted">Waiting for a caller.</p>}
      </form>
    </div>
  );
}
