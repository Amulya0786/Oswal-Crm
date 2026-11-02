"use client";

import { useEffect, useState } from "react";

export default function AssignPage() {
  const [rows, setRows] = useState<{ id: string; ticketNo: string; customerName: string; stateName: string | null; districtName: string | null; suggestedName: string | null; seniorReview: boolean }[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [district, setDistrict] = useState("");
  const [callType, setCallType] = useState("");
  const [reason, setReason] = useState("");
  async function load(next = page) {
    const params = new URLSearchParams({ page: String(next) });
    if (district) params.set("district", district);
    if (callType) params.set("callType", callType);
    const response = await fetch(`/api/desk/assign?${params}`);
    if (response.ok) {
      const body = await response.json();
      setRows(body.rows ?? []);
      setPage(body.page ?? next);
      setTotal(body.total ?? 0);
    }
  }
  useEffect(() => { void load(1); }, []);
  async function assign(ids: string[]) {
    const response = await fetch("/api/desk/assign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, reason }) });
    const body = await response.json();
    setMessage(response.ok ? `Assigned ${body.updated}` : body.error);
    setPicked([]);
    await load();
  }
  return (
    <div>
      <div className="filters">
        <label className="stack">District<input aria-label="District filter" value={district} onChange={(event) => setDistrict(event.target.value)} /></label>
        <label className="stack">Call type<input aria-label="Call type filter" value={callType} onChange={(event) => setCallType(event.target.value)} /></label>
        <label className="stack">Reason<input aria-label="Assign reason" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        <button className="btn line" type="button" onClick={() => void load(1)}>Filter</button>
      </div>
      <div className="page-head"><h1>To assign</h1><div className="filters">{picked.length > 0 && <button className="btn" onClick={() => void assign(picked)}>Assign selected</button>}<button className="btn line" type="button" disabled={page <= 1} onClick={() => void load(page - 1)}>Newer</button><button className="btn line" type="button" disabled={page * 50 >= total} onClick={() => void load(page + 1)}>Older</button></div></div>
      <p className="muted">{total} open · page {page}</p>
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
