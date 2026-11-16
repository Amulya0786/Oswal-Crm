"use client";

import { useState } from "react";

export default function ImportPage() {
  const [preview, setPreview] = useState<any>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [entity, setEntity] = useState("complaints");
  const [cutoff, setCutoff] = useState("2026-04-01");
  const [result, setResult] = useState<any>(null);

  return (
    <div>
      <div className="page-head"><div><h1>Import</h1></div></div>
      <form className="filters" onSubmit={async (event) => {
        event.preventDefault();
        const body = new FormData(event.currentTarget);
        const response = await fetch("/api/desk/import/preview", { method: "POST", body });
        const payload = await response.json();
        setPreview(payload);
        setMapping(payload.mapping ?? {});
        if (payload.cutoff) setCutoff(payload.cutoff);
      }}>
        <input type="file" name="file" accept=".csv,.xlsx" required />
        <button className="btn">Read file</button>
      </form>
      {preview && (
        <section className="panel stack">
          <p>{preview.rowCount} rows. {preview.eligible ?? preview.rowCount} are on or after the cutoff. {preview.skipped ?? 0} are older and will be skipped. {preview.undated ? `${preview.undated} have no book date.` : ""}</p>
          <label className="filters">Book date from<input type="date" value={cutoff} onChange={(event) => setCutoff(event.target.value)} /></label>
          <select value={entity} onChange={(event) => setEntity(event.target.value)}>
            <option value="complaints">Complaints</option>
            <option value="customers">Customers</option>
            <option value="products">Products</option>
            <option value="users">Users</option>
          </select>
          {preview.headers.map((header: string) => (
            <label key={header} className="filters">{header}
              <select value={mapping[header] ?? ""} onChange={(event) => setMapping({ ...mapping, [header]: event.target.value })}>
                <option value="">Ignore</option>
                {(preview.entities[entity] ?? []).map((field: [string, string]) => <option key={field[0]} value={field[0]}>{field[1]}</option>)}
              </select>
            </label>
          ))}
          <div className="table-wrap">
            <table>
              <thead><tr>{preview.headers.map((header: string) => <th key={header}>{header}</th>)}</tr></thead>
              <tbody>{preview.sample.map((row: Record<string, string>, index: number) => <tr key={index}>{preview.headers.map((header: string) => <td key={header}>{row[header]}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <button className="btn" onClick={async () => {
            const response = await fetch("/api/desk/import/commit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: preview.token, entity, mapping, cutoff }) });
            setResult(await response.json());
          }}>Import</button>
        </section>
      )}
      {result && <div className="banner">Created {result.created ?? 0}, updated {result.updated ?? 0}. Skipped {result.skipped ?? 0} before the cutoff. {result.undated ? `${result.undated} had no book date. ` : ""}{(result.errors ?? []).join(" ")}</div>}
    </div>
  );
}
