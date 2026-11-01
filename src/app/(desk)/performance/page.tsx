"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/chrome";
import { CALL_TYPES } from "@/lib/labels";

type Row = { name: string; closures: number; score: number; incentive: number; closureRate: number; tat: number; repeat: number; feedback: number; proof: number; reopen: number };

export default function PerformancePage() {
  const [tab, setTab] = useState<"Board" | "Proof" | "Incentives">("Board");
  const [rows, setRows] = useState<Row[]>([]);
  const [slabs, setSlabs] = useState<{ min: number; amount: number }[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/desk/performance").then(async (response) => {
      if (!response.ok) return;
      const body = await response.json();
      setRows(body.rows ?? []);
      setSlabs(body.slabs ?? []);
    });
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="kicker">Reports</p>
          <h1>Technician score</h1>
          <p>Closures, time against SLA, repeats inside 30 days, feedback, proof, and reopens. Weights are 25 / 20 / 20 / 15 / 10 / 10.</p>
        </div>
        <a className="btn line" href="/api/desk/scorecards?format=xlsx">Excel</a>
      </div>
      <div className="chips">
        {(["Board", "Proof", "Incentives"] as const).map((item) => <button key={item} className={`chip ${tab === item ? "on" : ""}`} onClick={() => setTab(item)}>{item}</button>)}
      </div>
      {tab === "Board" && !rows.length && <EmptyState title="No technician scores yet" body="Scores appear after visits are closed. The sheet stays empty while the register is empty." />}
      {tab === "Board" && !!rows.length && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Technician</th><th className="num">Score</th><th className="num">Closures</th><th className="num">Incentive</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.name}><td>{row.name}</td><td className="num">{row.score}</td><td className="num">{row.closures}</td><td className="num">{row.incentive}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      {tab === "Incentives" && (
        <section className="panel">
          <h2>Slabs</h2>
          {slabs.map((slab) => <p key={slab.min}>Score {slab.min} and above: ₹{slab.amount}</p>)}
        </section>
      )}
      {tab === "Proof" && (
        <section className="panel stack">
          <h2>What a close must include</h2>
          <p className="muted">Photo, signature or OTP, and GPS. A pin farther than the kilometre limit is flagged. Call-centre happy calling stays available when WhatsApp is not used.</p>
          {CALL_TYPES.map((type) => (
            <form key={type.id} className="filters" onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const response = await fetch("/api/desk/proof", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  callType: type.id,
                  requirePhoto: form.get("photo") === "on",
                  requireIdentity: form.get("identity") === "on",
                  requireGps: form.get("gps") === "on",
                  maxKm: Number(form.get("maxKm") || 15),
                }),
              });
              setMessage(response.ok ? `${type.label} saved.` : "Could not save");
            }}>
              <b>{type.label}</b>
              <label><input name="photo" type="checkbox" defaultChecked /> Photo</label>
              <label><input name="identity" type="checkbox" defaultChecked /> Signature or OTP</label>
              <label><input name="gps" type="checkbox" defaultChecked /> GPS</label>
              <input name="maxKm" type="number" defaultValue={15} />
              <button className="btn line">Save</button>
            </form>
          ))}
          {message && <p>{message}</p>}
        </section>
      )}
    </div>
  );
}
