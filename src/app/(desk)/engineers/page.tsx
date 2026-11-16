"use client";

import { useEffect, useState } from "react";

export default function EngineersPage() {
  const [rows, setRows] = useState<{ id: string; name: string; signaturePath: string | null }[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => {
    void fetch("/api/desk/masters/engineers").then(async (response) => {
      if (!response.ok) return;
      const body = await response.json();
      setRows((body.rows ?? []).map((row: { id: string; cells: Record<string, string> }) => ({ id: row.id, name: row.cells.Name, signaturePath: null })));
    });
  }, []);
  return (
    <div>
      <div className="page-head"><h1>Engineer signatures</h1></div>
      {message && <p>{message}</p>}
      {rows.map((row) => (
        <form key={row.id} className="filters" onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          data.set("engineerId", row.id);
          const response = await fetch("/api/desk/engineers/signature", { method: "POST", body: data });
          setMessage(response.ok ? `Saved ${row.name}` : "Could not save the signature");
        }}>
          <span>{row.name}</span>
          <label className="stack">Signature<input name="file" type="file" accept="image/*" aria-label={`Signature for ${row.name}`} required /></label>
          <button className="btn">Upload</button>
        </form>
      ))}
    </div>
  );
}
