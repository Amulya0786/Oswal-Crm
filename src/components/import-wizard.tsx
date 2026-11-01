"use client";

import { useState } from "react";
import { IMPORT_TARGETS, type ImportEntity, type ImportField } from "@/lib/import/targets";

type Preview = {
  token: string;
  sheets: string[];
  sheet: string;
  headers: string[];
  mapping: Record<string, string>;
  fields: ImportField[];
  preview: Record<string, string>[];
  missing: string[];
  rowCount: number;
  failed: { row: number; error: string }[];
  failedCount: number;
  created: number;
  updated: number;
};

export function ImportWizard() {
  const [entity, setEntity] = useState<ImportEntity>("complaints");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setPending(true);
    setMessage("");
    const body = new FormData();
    body.set("file", file);
    body.set("entity", entity);
    const response = await fetch("/api/import", { method: "POST", body });
    const data = await response.json();
    setPending(false);
    if (!response.ok) {
      setMessage(data.error ?? "Could not read the file.");
      return;
    }
    setPreview(data);
    setMapping(data.mapping ?? {});
  }

  async function recheck(nextSheet?: string, nextMapping = mapping) {
    if (!preview) return;
    setPending(true);
    const response = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: preview.token, entity, sheet: nextSheet ?? preview.sheet, mapping: nextMapping, write: false }),
    });
    const data = await response.json();
    setPending(false);
    if (!response.ok) {
      setMessage(data.error ?? "Could not refresh the preview.");
      return;
    }
    setPreview(data);
    setMapping(data.mapping ?? nextMapping);
  }

  async function commit() {
    if (!preview) return;
    setPending(true);
    setMessage("");
    const response = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: preview.token, entity, sheet: preview.sheet, mapping, write: true }),
    });
    const data = await response.json();
    setPending(false);
    if (!response.ok) {
      setMessage(data.error ?? "Import failed.");
      return;
    }
    setPreview(data);
    setMessage(`Created ${data.created}, updated ${data.updated}, failed ${data.failedCount}.`);
  }

  const fields = preview?.fields ?? IMPORT_TARGETS[entity].fields;

  return (
    <div className="space-y-4">
      <form onSubmit={upload} className="card grid gap-3 p-4 md:grid-cols-3">
        <label>
          <span className="label">What are you importing?</span>
          <select className="field" value={entity} onChange={(event) => { setEntity(event.target.value as ImportEntity); setPreview(null); }}>
            {Object.entries(IMPORT_TARGETS).map(([key, target]) => <option key={key} value={key}>{target.label}</option>)}
          </select>
        </label>
        <label>
          <span className="label">Excel or CSV</span>
          <input className="block w-full text-sm" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required />
        </label>
        <div className="flex items-end"><button className="btn btn-navy" disabled={pending}>{pending ? "Reading…" : "Upload and map"}</button></div>
        <p className="text-sm text-muted md:col-span-3">A sample Smartlogics workbook is in <span className="font-medium">samples/smartlogics-import.xlsx</span>. Column names such as Complaint No and Mobile No are suggested automatically.</p>
      </form>
      {preview ? (
        <section className="card space-y-4 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label>
              <span className="label">Sheet</span>
              <select className="field" value={preview.sheet} onChange={(event) => recheck(event.target.value)}>
                {preview.sheets.map((sheet) => <option key={sheet}>{sheet}</option>)}
              </select>
            </label>
            <p className="text-sm text-muted">{preview.rowCount} rows · {preview.failedCount} would fail</p>
          </div>
          {preview.missing.length > 0 ? <p className="text-sm text-rose-700">Map these required fields: {preview.missing.join(", ")}</p> : null}
          <div className="grid gap-3 md:grid-cols-2">
            {fields.map((field) => (
              <label key={field.key}>
                <span className="label">{field.label}{field.required ? " *" : ""}</span>
                <select className="field" value={mapping[field.key] ?? ""} onChange={(event) => setMapping({ ...mapping, [field.key]: event.target.value })}>
                  <option value="">Do not import</option>
                  {preview.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={() => recheck(preview.sheet, mapping)} disabled={pending}>Refresh preview</button>
            <button className="btn btn-accent" onClick={commit} disabled={pending || preview.missing.length > 0}>Import rows</button>
          </div>
          <div className="overflow-x-auto">
            <table className="data">
              <thead><tr>{fields.map((field) => <th key={field.key}>{field.label}</th>)}</tr></thead>
              <tbody>
                {preview.preview.map((row, index) => (
                  <tr key={index}>{fields.map((field) => <td key={field.key}>{row[field.key] || "—"}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.failed.length > 0 ? (
            <ul className="space-y-1 text-sm text-rose-800">
              {preview.failed.map((failure) => <li key={`${failure.row}-${failure.error}`}>Row {failure.row}: {failure.error}</li>)}
            </ul>
          ) : null}
        </section>
      ) : null}
      {message ? <p className="text-sm text-navy">{message}</p> : null}
    </div>
  );
}
