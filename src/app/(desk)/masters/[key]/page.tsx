"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function MasterDetailPage() {
  const params = useParams<{ key: string }>();
  const [data, setData] = useState<any>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [error, setError] = useState("");

  async function load(page = 1) {
    const response = await fetch(`/api/desk/masters/${params.key}?q=${encodeURIComponent(q)}&page=${page}`);
    const body = await response.json();
    if (!response.ok) setError(body.error);
    else setData(body);
  }
  useEffect(() => { void load(); }, [params.key]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const response = await fetch(`/api/desk/masters/${params.key}`, {
      method: editing?.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing?.id ? { ...payload, id: editing.id } : payload),
    });
    const body = await response.json();
    if (!response.ok) setError(body.error);
    else { setEditing(null); setError(""); await load(data.page); }
  }

  if (!data) return <p>Loading {params.key}…</p>;
  return (
    <div>
      <div className="page-head"><div><p className="kicker">Master</p><h1>{data.title}</h1><p>{data.total} records</p></div></div>
      {error && <div className="banner bad">{error}</div>}
      <form className="filters" onSubmit={(event) => { event.preventDefault(); void load(); }}>
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search" />
        <button className="btn">Search</button>
        {data.canWrite && <button type="button" className="btn line" onClick={() => setEditing({})}>Add</button>}
      </form>
      {editing && (
        <form className="panel stack" onSubmit={save}>
          {data.fields.map((field: any) => (
            <label key={field.key} className="stack">{field.label}
              {field.type === "select" ? (
                <select name={field.key} defaultValue={editing.raw?.[field.key] ?? ""}>
                  <option value="">—</option>
                  {(data.options[field.optionsKey] ?? []).map((option: { value: string; label: string }) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              ) : <input name={field.key} defaultValue={editing.raw?.[field.key] ?? ""} required={field.required} />}
            </label>
          ))}
          <button className="btn">Save</button>
        </form>
      )}
      {!data.rows.length && <section className="panel"><p className="muted">No {data.title.toLowerCase()} yet. Add the first record when you are ready.</p></section>}
      {!!data.rows.length && <div className="table-wrap">
        <table>
          <thead><tr>{data.columns.map((column: string) => <th key={column}>{column}</th>)}<th></th></tr></thead>
          <tbody>
            {data.rows.map((row: any) => (
              <tr key={row.id}>
                {data.columns.map((column: string) => <td key={column} data-label={column}>{row.cells[column]}</td>)}
                <td>{data.canWrite && <button className="btn line" onClick={() => setEditing(row)}>Edit</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
    </div>
  );
}
