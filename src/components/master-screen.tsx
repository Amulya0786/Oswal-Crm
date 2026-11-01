"use client";

import { useEffect, useState } from "react";
import type { MasterDefDTO, MasterFieldDTO, MasterRow } from "@/lib/master-types";

export function MasterScreen({ entity, def, canWrite }: { entity: string; def: MasterDefDTO; canWrite: boolean }) {
  const [rows, setRows] = useState<MasterRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [pages, setPages] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [options, setOptions] = useState<Record<string, { id: string; label: string }[]>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load(nextPage = page, query = q) {
    const response = await fetch(`/api/masters/${entity}?page=${nextPage}&q=${encodeURIComponent(query)}`);
    const data = await response.json();
    setRows(data.rows ?? []);
    setTotal(data.total ?? 0);
    setPages(Math.max(1, Math.ceil((data.total ?? 0) / (data.pageSize ?? 15))));
  }

  useEffect(() => {
    void load(1, "");
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity]);

  async function loadOptions(current: Record<string, unknown>) {
    const next: Record<string, { id: string; label: string }[]> = {};
    for (const field of def.fields) {
      if (field.type !== "relation" || !field.relation) continue;
      const params = new URLSearchParams({ model: field.relation.model, label: field.relation.label });
      if (field.relation.parentKey && current[field.relation.parentKey]) params.set(field.relation.parentKey, String(current[field.relation.parentKey]));
      const response = await fetch(`/api/options?${params}`);
      const data = await response.json();
      next[field.key] = data.options ?? [];
    }
    setOptions(next);
  }

  function startCreate() {
    const blank: Record<string, unknown> = {};
    for (const field of def.fields) blank[field.key] = field.type === "boolean" ? field.key !== "isDefault" : "";
    setForm(blank);
    setEditing(null);
    setOpen(true);
    setError("");
    void loadOptions(blank);
  }

  function startEdit(row: MasterRow) {
    const next: Record<string, unknown> = {};
    for (const field of def.fields) next[field.key] = row[field.key] ?? (field.type === "boolean" ? false : "");
    setForm(next);
    setEditing(String(row.id));
    setOpen(true);
    setError("");
    void loadOptions(next);
  }

  function setField(key: string, value: unknown) {
    const next = { ...form, [key]: value };
    for (const field of def.fields) {
      if (field.relation?.parentKey === key) next[field.key] = "";
    }
    setForm(next);
    void loadOptions(next);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch(editing ? `/api/masters/${entity}/${editing}` : `/api/masters/${entity}`, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Could not save.");
      return;
    }
    setOpen(false);
    await load();
  }

  async function remove(row: MasterRow) {
    if (!confirm("Delete this record?")) return;
    const response = await fetch(`/api/masters/${entity}/${row.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setNotice(data.error ?? "Could not delete.");
      return;
    }
    await load();
  }

  async function importFile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = new FormData(event.currentTarget);
    const response = await fetch(`/api/masters/${entity}/import`, { method: "POST", body });
    const data = await response.json();
    if (!response.ok) {
      setNotice(data.error ?? "Import failed.");
      return;
    }
    setNotice(`Imported ${data.created}. ${data.failedCount ? `${data.failedCount} rows failed.` : ""}`);
    event.currentTarget.reset();
    await load(1, q);
  }

  const columns = def.fields.filter((field) => def.columns.includes(field.key));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form className="flex flex-1 gap-2" onSubmit={(event) => { event.preventDefault(); setPage(1); void load(1, q); }}>
          <input className="field max-w-sm" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search" />
          <button className="btn btn-ghost">Search</button>
        </form>
        {canWrite ? <button className="btn btn-accent" onClick={startCreate}>Add</button> : null}
      </div>
      {notice ? <p className="mb-3 text-sm text-navy">{notice}</p> : null}
      <div className="card overflow-x-auto">
        <table className="data">
          <thead>
            <tr>
              {columns.map((column) => <th key={column.key}>{column.label}</th>)}
              {canWrite ? <th></th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={columns.length + 1} className="text-muted">No records yet.</td></tr> : null}
            {rows.map((row) => (
              <tr key={String(row.id)}>
                {columns.map((column) => <td key={column.key}>{display(row, column)}</td>)}
                {canWrite ? (
                  <td className="whitespace-nowrap text-right">
                    <button className="text-sm font-semibold text-navy" onClick={() => startEdit(row)}>Edit</button>
                    <button className="ml-3 text-sm text-rose-700" onClick={() => remove(row)}>Delete</button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-muted">
        <span>{total.toLocaleString("en-IN")} records</span>
        <div className="flex gap-2">
          <button className="btn btn-ghost" disabled={page <= 1} onClick={() => { setPage(page - 1); void load(page - 1, q); }}>Previous</button>
          <span>Page {page} / {pages}</span>
          <button className="btn btn-ghost" disabled={page >= pages} onClick={() => { setPage(page + 1); void load(page + 1, q); }}>Next</button>
        </div>
      </div>
      {canWrite ? (
        <form onSubmit={importFile} className="card mt-4 flex flex-wrap items-end gap-3 p-4">
          <label className="block">
            <span className="label">Bulk import Excel / CSV</span>
            <input type="file" name="file" accept=".xlsx,.xls,.csv" required className="text-sm" />
          </label>
          <button className="btn btn-navy">Import</button>
          <p className="text-xs text-muted">Headers can match the field labels. Related values can be names, for example the state name.</p>
        </form>
      ) : null}
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-navy/40 p-4">
          <form onSubmit={save} className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5">
            <h2 className="font-display text-xl font-semibold text-navy">{editing ? "Edit" : "Add"} {def.label}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {def.fields.map((field) => (
                <label key={field.key} className={field.fullWidth || field.type === "textarea" ? "sm:col-span-2" : ""}>
                  <span className="label">{field.label}</span>
                  {field.type === "textarea" ? <textarea className="field min-h-20" value={String(form[field.key] ?? "")} onChange={(event) => setField(field.key, event.target.value)} /> : null}
                  {field.type === "boolean" ? <input type="checkbox" checked={Boolean(form[field.key])} onChange={(event) => setField(field.key, event.target.checked)} /> : null}
                  {field.type === "select" ? (
                    <select className="field" value={String(form[field.key] ?? "")} onChange={(event) => setField(field.key, event.target.value)}>
                      <option value="">Select</option>
                      {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  ) : null}
                  {field.type === "relation" ? (
                    <select className="field" value={String(form[field.key] ?? "")} onChange={(event) => setField(field.key, event.target.value)}>
                      <option value="">Select</option>
                      {(options[field.key] ?? []).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                  ) : null}
                  {field.type === "text" || field.type === "number" ? (
                    <input className="field" type={field.type === "number" ? "number" : "text"} step="any" value={String(form[field.key] ?? "")} onChange={(event) => setField(field.key, event.target.value)} required={field.required} />
                  ) : null}
                </label>
              ))}
            </div>
            {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-accent">Save</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function display(row: MasterRow, field: MasterFieldDTO) {
  if (field.type === "relation" && field.relation) {
    const related = row[field.relation.name] as Record<string, unknown> | null;
    return related ? String(related[field.relation.label] ?? "—") : "—";
  }
  if (field.type === "boolean") return row[field.key] ? "Yes" : "No";
  if (field.type === "select") return field.options?.find((option) => option.value === row[field.key])?.label ?? String(row[field.key] ?? "—");
  const value = row[field.key];
  return value === null || value === undefined || value === "" ? "—" : String(value);
}
