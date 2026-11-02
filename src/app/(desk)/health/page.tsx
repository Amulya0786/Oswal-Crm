"use client";

import { useEffect, useState } from "react";

export default function HealthPage() {
  const [data, setData] = useState<any>(null);
  const [message, setMessage] = useState("");
  async function load() {
    const response = await fetch("/api/desk/health");
    if (response.ok) setData(await response.json());
  }
  useEffect(() => { void load(); }, []);
  async function run(path: string, body: object = {}) {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json();
    setMessage(JSON.stringify(payload));
    await load();
  }
  return (
    <div>
      <div className="page-head"><h1>Data health</h1></div>
      {message && <pre className="panel">{message}</pre>}
      {data && (
        <table>
          <tbody>
            <tr><th>Duplicate district names</th><td>{data.duplicateDistrictNames}</td></tr>
            <tr><th>Open complaints missing a district</th><td>{data.missingDistrict}</td></tr>
            <tr><th>Junk names</th><td>{data.junkNames} · <a href="/complaints?nameReview=1">Name needs review</a></td></tr>
            <tr><th>Names with question marks</th><td>{data.questionNames}</td></tr>
            <tr><th>Test users</th><td>{data.testUsers}</td></tr>
            <tr><th>Test tickets</th><td>{data.testTickets}</td></tr>
            <tr><th>Pincodes with a block</th><td>{data.pincodes?.linkedBlock ?? 0}</td></tr>
            <tr><th>Urban pincodes</th><td>{data.pincodes?.urban ?? 0}</td></tr>
            <tr><th>District HQ, approximate</th><td>{data.pincodes?.approximate ?? 0}</td></tr>
            <tr><th>Pincodes with no block</th><td>{data.pincodes?.none ?? 0}</td></tr>
            <tr><th>Also urban among linked blocks</th><td>{data.pincodes?.overlapLinkedUrban ?? 0}</td></tr>
            <tr><th>Also urban among approximate</th><td>{data.pincodes?.overlapApproximateUrban ?? 0}</td></tr>
          </tbody>
        </table>
      )}
      <div className="filters" style={{ marginTop: 16 }}>
        <button className="btn line" onClick={() => void run("/api/desk/health/purge")}>Purge QA dry run</button>
        <button className="btn" onClick={() => void run("/api/desk/health/purge", { apply: true })}>Purge QA</button>
        <button className="btn line" onClick={() => void run("/api/desk/health/purge", { undo: true })}>Undo last purge</button>
        <button className="btn line" onClick={() => void run("/api/desk/health/aliases")}>Seed district aliases</button>
        <button className="btn line" onClick={() => void run("/api/desk/health/tehsils")}>Seed tehsils</button>
        <button className="btn line" onClick={() => void run("/api/desk/health/cities")}>Seed cities</button>
        <button className="btn line" onClick={() => void run("/api/desk/health/merge-aliases")}>Merge aliases dry run</button>
        <button className="btn" onClick={() => void run("/api/desk/health/merge-aliases", { apply: true })}>Merge all aliases</button>
        <button className="btn line" onClick={() => void run("/api/desk/health/pincodes")}>Link pincodes</button>
      </div>
      <h2>Merge list</h2>
      <ul>{(data?.mergeList ?? []).map((row: { alias: string; state: string; into: string }) => <li key={`${row.state}-${row.alias}`}>{row.alias}, {row.state} → {row.into}</li>)}</ul>
    </div>
  );
}
