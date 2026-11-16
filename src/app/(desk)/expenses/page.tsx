"use client";

import { useEffect, useState } from "react";

type Row = { id: string; type: string; amount: number; detail: string | null; status: string; billPath: string | null; at: string; engineer: { name: string } };

export default function ExpensesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<{ type: string; _sum: { amount: number | null } }[]>([]);
  const [message, setMessage] = useState("");
  async function load() {
    const response = await fetch("/api/desk/expenses");
    if (!response.ok) return;
    const body = await response.json();
    setRows(body.rows ?? []);
    setSummary(body.summary ?? []);
  }
  useEffect(() => { void load(); }, []);
  return (
    <div>
      <div className="page-head"><h1>Expenses</h1></div>
      {message && <p>{message}</p>}
      <form className="filters" onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        let billPath = "";
        const file = data.get("bill");
        if (file instanceof File && file.size) {
          const upload = new FormData();
          upload.set("file", file);
          const saved = await fetch("/api/desk/expenses/bill", { method: "POST", body: upload });
          const body = await saved.json();
          if (!saved.ok) { setMessage(body.error ?? "Could not save the bill"); return; }
          billPath = body.path;
        }
        const response = await fetch("/api/desk/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: data.get("type"), amount: Number(data.get("amount")), detail: data.get("detail"), engineerId: data.get("engineerId"), billPath }),
        });
        setMessage(response.ok ? "Saved" : "Could not save");
        form.reset();
        await load();
      }}>
        <label className="stack">Engineer id<input name="engineerId" aria-label="Engineer id" /></label>
        <label className="stack">Type<select name="type" aria-label="Expense type" defaultValue="TA"><option>TA</option><option>DA</option><option>Other</option></select></label>
        <label className="stack">Amount<input name="amount" type="number" aria-label="Amount" required /></label>
        <label className="stack">Detail<input name="detail" aria-label="Detail" /></label>
        <label className="stack">Bill photo<input name="bill" type="file" accept="image/*" aria-label="Bill photo" /></label>
        <button className="btn">Save</button>
      </form>
      <h2>Summary</h2>
      <table><tbody>{summary.map((row) => <tr key={row.type}><td>{row.type}</td><td>{row._sum.amount ?? 0}</td></tr>)}</tbody></table>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Technician</th><th>Type</th><th>Amount</th><th>Status</th><th>Bill</th><th></th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.engineer.name}</td>
                <td>{row.type}</td>
                <td>{row.amount}</td>
                <td>{row.status}</td>
                <td>{row.billPath ? "Yes" : ""}</td>
                <td>
                  <button className="btn line" onClick={async () => { await fetch("/api/desk/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id, status: "APPROVED" }) }); await load(); }}>Approve</button>
                  <button className="btn line" onClick={async () => { await fetch("/api/desk/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id, status: "REJECTED" }) }); await load(); }}>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
