"use client";

import { useEffect, useState } from "react";

export default function AssignPage() {
  const [rows, setRows] = useState<{ id: string; ticketNo: string; customerName: string; stateName: string | null; districtName: string | null; suggestedName: string | null; seniorReview: boolean }[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  async function load() {
    const response = await fetch("/api/desk/assign");
    if (response.ok) setRows((await response.json()).rows ?? []);
  }
  useEffect(() => { void load(); }, []);
  async function assign(ids: string[]) {
    const response = await fetch("/api/desk/assign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
    const body = await response.json();
    setMessage(response.ok ? `Assigned ${body.updated}` : body.error);
    setPicked([]);
    await load();
  }
  return (
    <div>
      <div className="page-head"><h1>To assign</h1>{picked.length > 0 && <button className="btn" onClick={() => void assign(picked)}>Assign selected</button>}</div>
      {message && <div className="banner">{message}</div>}
      <div className="table-wrap">
        <table>
          <thead><tr><th></th><th>Complaint</th><th>Customer</th><th>Place</th><th>Suggestion</th><th></th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><input aria-label={`Select ${row.ticketNo}`} type="checkbox" checked={picked.includes(row.id)} onChange={(event) => setPicked(event.target.checked ? [...picked, row.id] : picked.filter((id) => id !== row.id))} /></td>
                <td><a href={`/complaints/${row.id}`}>{row.ticketNo}</a>{row.seniorReview ? " · senior" : ""}</td>
                <td>{row.customerName}</td>
                <td>{row.districtName}, {row.stateName}</td>
                <td>{row.suggestedName ?? "No suggestion"}</td>
                <td><button className="btn" onClick={() => void assign([row.id])}>Confirm</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p>Nothing is waiting.</p>}
    </div>
  );
}
