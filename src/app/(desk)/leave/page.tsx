"use client";

import { useEffect, useState } from "react";

type Row = { id: string; reason: string; status: string; from: string; to: string; engineer: { name: string } };

export default function LeavePage() {
  const [rows, setRows] = useState<Row[]>([]);
  async function load() {
    const response = await fetch("/api/desk/leave");
    if (response.ok) setRows((await response.json()).rows ?? []);
  }
  useEffect(() => { void load(); }, []);
  async function decide(id: string, status: string) {
    await fetch("/api/desk/leave", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    await load();
  }
  return (
    <div>
      <div className="page-head"><h1>Leave</h1></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Technician</th><th>From</th><th>To</th><th>Reason</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.engineer?.name}</td>
                <td>{new Date(row.from).toLocaleDateString("en-IN")}</td>
                <td>{new Date(row.to).toLocaleDateString("en-IN")}</td>
                <td>{row.reason}</td>
                <td>{row.status}</td>
                <td>
                  {row.status === "PENDING" && <>
                    <button className="btn" onClick={() => void decide(row.id, "APPROVED")}>Approve</button>
                    <button className="btn line" onClick={() => void decide(row.id, "REJECTED")}>Reject</button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p>No leave requests.</p>}
    </div>
  );
}
